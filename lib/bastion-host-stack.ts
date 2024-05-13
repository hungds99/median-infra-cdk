import { Stack, StackProps } from 'aws-cdk-lib';
import {
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  KeyPair,
  MachineImage,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

type BastionHostStackProps = StackProps & {
  vpc: Vpc;
};

export class BastionHostStack extends Stack {
  constructor(scope: Construct, id: string, props: BastionHostStackProps) {
    super(scope, id, props);

    // Bastion host security group
    const bastionHostSG = new SecurityGroup(this, 'MedianBastionHostSG', {
      vpc: props.vpc,
      securityGroupName: 'MedianBastionHostSG',
    });
    bastionHostSG.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow SSH traffic');

    // Key pair
    const ec2KeyPair = KeyPair.fromKeyPairName(this, 'MedianKeyPair', 'median-key-pair');

    // Bastion host instance
    const bastionHost1 = new Instance(this, 'MedianBastionHost1', {
      vpc: props.vpc,
      instanceName: 'MedianBastionHost1',
      securityGroup: bastionHostSG,
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux2023(),
      vpcSubnets: { subnetType: SubnetType.PUBLIC, availabilityZones: ['ap-southeast-1a'] },
      keyPair: ec2KeyPair,
    });

    const bastionHost2 = new Instance(this, 'MedianBastionHost2', {
      vpc: props.vpc,
      instanceName: 'MedianBastionHost2',
      securityGroup: bastionHostSG,
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux2023(),
      vpcSubnets: { subnetType: SubnetType.PUBLIC, availabilityZones: ['ap-southeast-1b'] },
      keyPair: ec2KeyPair,
    });
  }
}
