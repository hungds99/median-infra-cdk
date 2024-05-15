import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import {
  InstanceType,
  KeyPair,
  LaunchTemplate,
  MachineImage,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  UserData,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerAction,
  ListenerCertificate,
  ListenerCondition,
  TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {
  Effect,
  InstanceProfile,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

type AlbStackProps = StackProps & {
  vpc: Vpc;
};

export class AlbStack extends Stack {
  autoscalingGroup: AutoScalingGroup;
  applicationLoadBalancer: ApplicationLoadBalancer;
  applicationTargetGroup: ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id, props);

    // Alb security group
    const albSG = new SecurityGroup(this, 'MedianALBSG', {
      vpc: props.vpc,
      securityGroupName: 'MedianALBSG',
    });
    albSG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP traffic');
    albSG.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS traffic');

    // Create a target group
    this.applicationTargetGroup = new ApplicationTargetGroup(this, 'MedianTargetGroup', {
      targetGroupName: 'MedianTargetGroup',
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: TargetType.INSTANCE,
    });

    // Create an Alb
    this.applicationLoadBalancer = new ApplicationLoadBalancer(this, 'MedianALB', {
      loadBalancerName: 'MedianALB',
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSG,
    });
    const albHttpListener = this.applicationLoadBalancer.addListener('MedianALBListener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      defaultTargetGroups: [this.applicationTargetGroup],
    });
    albHttpListener.addAction('MedianALBHttpListenerRule', {
      priority: 1,
      conditions: [ListenerCondition.pathPatterns(['*'])],
      action: ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    const httpsListenerCertificate = ListenerCertificate.fromArn(
      'arn:aws:acm:ap-southeast-1:046397301718:certificate/d006d91a-71d5-4940-8fcf-816674b88903',
    );
    const albHttpsListener = this.applicationLoadBalancer.addListener('MedianALBListenerHTTPS', {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [httpsListenerCertificate],
    });
    albHttpsListener.addTargetGroups('AddTargetGroup', {
      targetGroups: [this.applicationTargetGroup],
    });

    // EC2 security group
    const ec2SG = new SecurityGroup(this, 'MedianEC2SG', {
      vpc: props.vpc,
      securityGroupName: 'MedianEC2SG',
      allowAllOutbound: true,
    });
    ec2SG.addIngressRule(albSG, Port.tcp(80), 'Allow HTTP traffic from ALB');

    // const bastionHostSG = SecurityGroup.fromSecurityGroupId(
    //   this,
    //   'MedianBastionHostSG',
    //   'sg-0d6ac69c780c704ef',
    // );
    // ec2SG.addIngressRule(bastionHostSG, Port.tcp(22), 'Allow SSH traffic from Bastion Host');

    // Get KeyPair
    const ec2KeyPair = KeyPair.fromKeyPairName(this, 'MedianKeyPair', 'median-key-pair');
    // User data
    const ec2UserData = UserData.forLinux();
    ec2UserData.addCommands(
      'yum update -y',
      'systemctl restart nginx',
      'systemctl enable nginx',
      'cd /usr/src/app/median-backend-rest-api',
      'pm2 start dist/src/main.js --watch',
      // 'sleep 30',
      // 'TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`',
      // 'INSTANCE_ID=`curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id`',
      // 'aws autoscaling complete-lifecycle-action --lifecycle-action-result CONTINUE --instance-id $INSTANCE_ID --lifecycle-hook-name median-lifecycle-hook --auto-scaling-group-name MedianASG --region ap-southeast-1',
    );

    const ec2Role = new Role(this, 'MedianEC2Role', {
      roleName: 'MedianEC2InstanceProfile',
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      description: 'Median Role for EC2 instances',
      managedPolicies: [
        {
          managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        },
        {
          managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforAWSCodeDeploy',
        },
        { managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCodeDeployDeployerAccess' },
      ],
    });

    const ec2InstanceProfile = new InstanceProfile(this, 'MedianEC2InstanceProfile', {
      instanceProfileName: 'MedianEC2InstanceProfile',
      role: ec2Role,
    });

    // EC2 launch template
    const ec2LaunchTemplate = new LaunchTemplate(this, 'MedianEC2LaunchTemplate', {
      launchTemplateName: 'MedianEC2LaunchTemplate',
      machineImage: MachineImage.genericLinux(
        {
          'ap-southeast-1': 'ami-02dcd6051cdd9671b',
        },
        {
          userData: ec2UserData,
        },
      ),
      instanceType: new InstanceType('t2.micro'),
      keyPair: ec2KeyPair,
      securityGroup: ec2SG,
      instanceProfile: ec2InstanceProfile,
    });

    // Create a Auto Scaling group
    this.autoscalingGroup = new AutoScalingGroup(this, 'MedianASG', {
      autoScalingGroupName: 'MedianASG',
      vpc: props.vpc,
      minCapacity: 1,
      desiredCapacity: 2,
      maxCapacity: 3,
      launchTemplate: ec2LaunchTemplate,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    });
    this.autoscalingGroup.attachToApplicationTargetGroup(this.applicationTargetGroup);

    // ec2Role.addToPolicy(
    //   new PolicyStatement({
    //     effect: Effect.ALLOW,
    //     actions: ['autoscaling:CompleteLifecycleAction'],
    //     resources: [this.autoscalingGroup.autoScalingGroupArn],
    //   }),
    // );

    // Output the Alb DNS name
    new CfnOutput(this, 'MedianALBDNSName', {
      key: 'MedianALBDNSName',
      exportName: 'MedianALBDNSName',
      value: this.applicationLoadBalancer.loadBalancerDnsName,
    });
    new CfnOutput(this, 'MedianEC2TemplateVersion', {
      key: 'MedianEC2TemplateVersion',
      exportName: 'MedianEC2TemplateVersion',
      value: ec2LaunchTemplate.versionNumber,
    });
  }
}
