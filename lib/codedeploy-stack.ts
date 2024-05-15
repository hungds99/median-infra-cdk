import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import {
  LoadBalancer,
  ServerApplication,
  ServerDeploymentConfig,
  ServerDeploymentGroup,
} from 'aws-cdk-lib/aws-codedeploy';
import {
  ApplicationLoadBalancer,
  ApplicationTargetGroup,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

type CodedeployStackProps = StackProps & {
  autoscalingGroup: AutoScalingGroup;
  applicationLoadBalancer: ApplicationLoadBalancer;
  applicationTargetGroup: ApplicationTargetGroup;
};

export class CodedeployStack extends Stack {
  constructor(scope: Construct, id: string, props: CodedeployStackProps) {
    super(scope, id, props);

    // Application that deploys EC2 instances in the autoscaling group
    const application = new ServerApplication(this, 'MedianCodedeployApplication', {
      applicationName: 'MedianCodedeployApplication',
    });

    // Deployment group - In place deployment
    const deploymentGroup = new ServerDeploymentGroup(this, 'MedianServerDeploymentGroup', {
      application,
      deploymentGroupName: 'MedianServerDeploymentGroup',
      loadBalancers: [LoadBalancer.application(props.applicationTargetGroup)],
      autoScalingGroups: [props.autoscalingGroup],
      deploymentConfig: ServerDeploymentConfig.ALL_AT_ONCE,
      role: Role.fromRoleArn(
        this,
        'MedianCodedeployRole',
        'arn:aws:iam::046397301718:role/AWSCodeDeployDeployerAccess',
      ),
    });

    // Output
    new CfnOutput(this, 'MedianCodedeployApplicationName', {
      value: application.applicationName,
    });

    new CfnOutput(this, 'MedianCodedeployDeploymentGroupName', {
      value: deploymentGroup.deploymentGroupName,
    });
  }
}
