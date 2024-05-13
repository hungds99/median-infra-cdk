import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends Stack {
  vpc: Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a VPC (1 public, 2 private, 2 isolated subnets)
    this.vpc = new Vpc(this, 'MedianVPC', {
      vpcName: 'MedianVPC',
      availabilityZones: ['ap-southeast-1a', 'ap-southeast-1b'],
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Output the VPC ID
    new CfnOutput(this, 'MedianVPCID', {
      key: 'MedianVPCID',
      exportName: 'MedianVPCID',
      value: this.vpc.vpcId,
    });
  }
}
