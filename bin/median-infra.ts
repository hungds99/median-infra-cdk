#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import 'source-map-support/register';
import { AlbStack } from '../lib/alb-stack';
import { BastionHostStack } from '../lib/bastion-host-stack';
import { RdsStack } from '../lib/rds-stack';
import { VpcStack } from '../lib/vpc-stack';

const app = new App({});
// Create the VPC stack
const vpcStack = new VpcStack(app, 'MedianVPCStack', {
  description: 'Median VPC Stack',
});

// Create the ALB stack
new AlbStack(app, 'MedianAlbStack', {
  description: 'Median ALB Stack',
  vpc: vpcStack.vpc,
});

// Create the RDS stack
new RdsStack(app, 'MedianRdsStack', {
  description: 'Median RDS Stack',
  vpc: vpcStack.vpc,
});

// Create the Bastion Host stack
new BastionHostStack(app, 'MedianBastionHostStack', {
  description: 'Median Bastion Host Stack',
  vpc: vpcStack.vpc,
});
