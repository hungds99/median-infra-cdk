#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import 'source-map-support/register';
import { AlbStack } from '../lib/alb-stack';
import { BastionHostStack } from '../lib/bastion-host-stack';
import { RdsStack } from '../lib/rds-stack';
import { VpcStack } from '../lib/vpc-stack';
import { CodedeployStack } from '../lib/codedeploy-stack';

const app = new App({});
// Create the VPC stack
const vpcStack = new VpcStack(app, 'MedianVPCStack', {
  description: 'Median VPC Stack',
});

// Create the ALB stack
const albStack = new AlbStack(app, 'MedianAlbStack', {
  description: 'Median ALB Stack',
  vpc: vpcStack.vpc,
});

// Create Codedeploy stack
new CodedeployStack(app, 'MedianCodedeployStack', {
  description: 'Median Codedeploy Stack',
  autoscalingGroup: albStack.autoscalingGroup,
  applicationLoadBalancer: albStack.applicationLoadBalancer,
  applicationTargetGroup: albStack.applicationTargetGroup,
});

// Create the RDS stack
// new RdsStack(app, 'MedianRdsStack', {
//   description: 'Median RDS Stack',
//   vpc: vpcStack.vpc,
// });

// Create the Bastion Host stack
// new BastionHostStack(app, 'MedianBastionHostStack', {
//   description: 'Median Bastion Host Stack',
//   vpc: vpcStack.vpc,
// });
