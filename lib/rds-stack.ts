import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { DatabaseInstance, DatabaseInstanceEngine } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

type RdsStackProps = StackProps & {
  vpc: Vpc;
};

export class RdsStack extends Stack {
  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    // Create a postgres RDS instance security group
    const eec2SG = SecurityGroup.fromSecurityGroupId(this, 'MedianEC2SG', 'sg-0e5b7aaaf262950c6');
    const postgresSG = new SecurityGroup(this, 'MedianPostgresSG', {
      vpc: props.vpc,
      securityGroupName: 'MedianPostgresSG',
    });
    postgresSG.addIngressRule(eec2SG, Port.tcp(5432), 'Allow EC2 to connect to RDS');

    // Create a postgres RDS instance
    const postgresInstance = new DatabaseInstance(this, 'MedianPostgresRDS', {
      engine: DatabaseInstanceEngine.POSTGRES,
      databaseName: 'median',
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [postgresSG],
      deleteAutomatedBackups: false,
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Output the RDS endpoint
    new CfnOutput(this, 'MedianPostgresRdsEndpoint', {
      key: 'MedianPostgresRdsEndpoint',
      exportName: 'MedianPostgresRdsEndpoint',
      value: postgresInstance.dbInstanceEndpointAddress,
    });
  }
}
