import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

import { loadConfig, resourceName } from "./config.js";
import { createNetworking } from "./networking.js";
import { createDatabase } from "./database.js";
import { createDroplets } from "./droplets/index.js";
import { agentUserData } from "./droplets/agent.js";
import { webappUserData } from "./droplets/webapp.js";
import { adminUserData } from "./droplets/admin.js";
import { createLoadBalancers } from "./loadbalancer.js";
import { createMonitoring } from "./monitoring.js";
import { createDnsRecords } from "./dns.js";

// Load configuration
const config = loadConfig();

// Get SSH key
const sshKey = digitalocean.getSshKeyOutput({
  name: config.sshKeyName,
});

// =============================================================================
// Networking
// =============================================================================

const networking = createNetworking(config);

// =============================================================================
// Database
// =============================================================================

const database = createDatabase(config, {
  vpcId: networking.vpc.id,
});

// =============================================================================
// Agent Droplets (Backend - WebSocket server)
// =============================================================================

const agent = createDroplets(config, {
  vpcId: networking.vpc.id,
  sshKeyIds: [sshKey.id.apply((id) => id.toString())],
  size: config.agentSize,
  count: config.agentCount,
  role: "agent",
  userData: (index: number) => agentUserData(config, database.privateConnectionString, index),
  tags: [
    networking.projectTag.name,
    networking.envTag.name,
    networking.backendTag.name,
    networking.combinedBackendTag.name,
  ],
});

// =============================================================================
// Admin Droplets (Admin CMS - proxied through webapp)
// =============================================================================

const admin = createDroplets(config, {
  vpcId: networking.vpc.id,
  sshKeyIds: [sshKey.id.apply((id) => id.toString())],
  size: config.adminSize,
  count: config.adminCount,
  role: "admin",
  userData: adminUserData(config, {
    databaseUrl: database.privateConnectionString,
    adminDatabaseUrl: database.adminConnectionString,
    dbUsername: database.user.name,
  }),
  tags: [
    networking.projectTag.name,
    networking.envTag.name,
    networking.frontendTag.name,
    networking.combinedFrontendTag.name,
  ],
});

// =============================================================================
// Webapp Droplets (Frontend - Main Next.js app)
// Proxies admin.dev.androiduse.com to admin droplet
// =============================================================================

const webapp = createDroplets(config, {
  vpcId: networking.vpc.id,
  sshKeyIds: [sshKey.id.apply((id) => id.toString())],
  size: config.webappSize,
  count: config.webappCount,
  role: "webapp",
  userData: webappUserData(config, {
    databaseUrl: database.privateConnectionString,
    adminDatabaseUrl: database.adminConnectionString,
    dbUsername: database.user.name,
  }),
  tags: [
    networking.projectTag.name,
    networking.envTag.name,
    networking.frontendTag.name,
    networking.combinedFrontendTag.name,
  ],
});

// =============================================================================
// Load Balancers
// - Frontend LB: webapp droplets only (dev.androiduse.com, www, api)
// - Backend LB: agent droplets (agent.dev.androiduse.com - WebSocket)
// - Admin: runs separately, accessed directly or needs separate routing
// =============================================================================

const agentDropletIdsAsNumbers = pulumi.all(agent.ids).apply((ids) =>
  ids.map((id) => parseInt(id, 10))
);

const webappDropletIdsAsNumbers = pulumi.all(webapp.ids).apply((ids) =>
  ids.map((id) => parseInt(id, 10))
);

const adminDropletIdsAsNumbers = pulumi.all(admin.ids).apply((ids) =>
  ids.map((id) => parseInt(id, 10))
);

const loadBalancers = createLoadBalancers(config, {
  vpcId: networking.vpc.id,
  webappDropletIds: webappDropletIdsAsNumbers,
  agentDropletIds: agentDropletIdsAsNumbers,
  adminDropletIds: adminDropletIdsAsNumbers,
});

// =============================================================================
// DNS Records
// =============================================================================

let dns;
if (config.manageDns) {
  dns = createDnsRecords(config, {
    rootDomain: config.rootDomain,
    subdomainPrefix: config.subdomainPrefix,
    frontendLoadBalancerIp: loadBalancers.webappIp,
    backendLoadBalancerIp: loadBalancers.agentIp,
    adminIp: admin.publicIps[0],
  });
}

// =============================================================================
// Monitoring (Production Only)
// =============================================================================

let monitoring;
if (config.environment === "production") {
  const allDropletIds = pulumi
    .all([agent.ids, webapp.ids, admin.ids])
    .apply(([a, w, ad]) => [...a, ...w, ...ad]);

  monitoring = createMonitoring(config, {
    dropletIds: allDropletIds,
  });
}

// =============================================================================
// DigitalOcean Project (Groups all resources)
// =============================================================================

// Collect DigitalOcean URNs (not Pulumi URNs) for Project resource assignment
const allUrns = pulumi
  .all([
    agent.urns,
    webapp.urns,
    admin.urns,
    database.cluster.clusterUrn,
    loadBalancers.webappLoadBalancer.loadBalancerUrn,
    loadBalancers.agentLoadBalancer.loadBalancerUrn,
  ])
  .apply(([agentUrns, webappUrns, adminUrns, dbUrn, webappLbUrn, agentLbUrn]) => [
    ...agentUrns,
    ...webappUrns,
    ...adminUrns,
    dbUrn,
    webappLbUrn,
    agentLbUrn,
  ]);

new digitalocean.Project(resourceName(config, "project"), {
  name: `${config.projectName}-${config.environment}`,
  description: `AndroidUse Platform - ${config.environment}`,
  purpose: "Web Application",
  environment:
    config.environment === "production" ? "Production" : "Development",
  resources: allUrns,
});

// =============================================================================
// Exports
// =============================================================================

// Network
export const vpcId = networking.vpc.id;
export const vpcIpRange = networking.vpc.ipRange;

// Database
export const databaseHost = database.cluster.host;
export const databasePrivateHost = database.cluster.privateHost;
export const databasePort = database.cluster.port;
export const databaseName = database.database.name;
export const databaseUser = database.user.name;
export const databasePassword = pulumi.secret(database.user.password);
export const databaseConnectionString = pulumi.secret(
  database.connectionString
);
export const databasePoolConnectionString = pulumi.secret(
  database.poolConnectionString
);

// Agent (Backend)
export const agentDropletIds = agent.ids;
export const agentPublicIps = agent.publicIps;
export const agentPrivateIps = agent.privateIps;

// Webapp (Frontend)
export const webappDropletIds = webapp.ids;
export const webappPublicIps = webapp.publicIps;
export const webappPrivateIps = webapp.privateIps;

// Admin (behind frontend load balancer)
export const adminDropletIds = admin.ids;
export const adminPublicIps = admin.publicIps;
export const adminPrivateIps = admin.privateIps;

// Load Balancers
export const frontendLoadBalancerIp = loadBalancers.webappIp;
export const backendLoadBalancerIp = loadBalancers.agentIp;

// URLs
export const appUrl = `https://${config.domainName}`;
export const apiUrl = `https://api.${config.domainName}`;
export const agentUrl = `https://agent.${config.domainName}`;
export const adminUrl = `https://admin.${config.domainName}`;
export const agentWsUrl = `wss://agent.${config.domainName}`;

// SSH Commands
export const sshAgentCommand = agent.publicIps[0].apply(
  (ip) => `ssh root@${ip}`
);
export const sshWebappCommand = webapp.publicIps[0].apply(
  (ip) => `ssh root@${ip}`
);
export const sshAdminCommand = admin.publicIps[0].apply(
  (ip) => `ssh root@${ip}`
);