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
  ListenerCertificate,
  TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

type AlbStackProps = StackProps & {
  vpc: Vpc;
};

export class AlbStack extends Stack {
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
    const targetGroup = new ApplicationTargetGroup(this, 'MedianTargetGroup', {
      targetGroupName: 'MedianTargetGroup',
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      vpc: props.vpc,
      targetType: TargetType.INSTANCE,
    });

    // Create an Alb
    const alb = new ApplicationLoadBalancer(this, 'MedianALB', {
      loadBalancerName: 'MedianALB',
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSG,
    });
    const albHttpListener = alb.addListener('MedianALBListener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
    });
    albHttpListener.addTargetGroups('AddTargetGroup', {
      targetGroups: [targetGroup],
    });

    const httpsListenerCertificate = ListenerCertificate.fromArn(
      'arn:aws:acm:ap-southeast-1:046397301718:certificate/d006d91a-71d5-4940-8fcf-816674b88903',
    );
    const albHttpsListener = alb.addListener('MedianALBListenerHTTPS', {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [httpsListenerCertificate],
    });
    albHttpsListener.addTargetGroups('AddTargetGroup', {
      targetGroups: [targetGroup],
    });

    // EC2 security group
    const ec2SG = new SecurityGroup(this, 'MedianEC2SG', {
      vpc: props.vpc,
      securityGroupName: 'MedianEC2SG',
      allowAllOutbound: true,
    });
    ec2SG.addIngressRule(albSG, Port.tcp(80), 'Allow HTTP traffic from ALB');

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
    );

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
    });

    // Create a Auto Scaling group
    const asg = new AutoScalingGroup(this, 'MedianASG', {
      autoScalingGroupName: 'MedianASG',
      vpc: props.vpc,
      minCapacity: 1,
      desiredCapacity: 2,
      maxCapacity: 3,
      launchTemplate: ec2LaunchTemplate,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    });
    asg.attachToApplicationTargetGroup(targetGroup);

    // Output the Alb DNS name
    new CfnOutput(this, 'MedianALBDNSName', {
      key: 'MedianALBDNSName',
      exportName: 'MedianALBDNSName',
      value: alb.loadBalancerDnsName,
    });
  }
}