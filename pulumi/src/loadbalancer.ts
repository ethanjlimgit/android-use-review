import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import { InfraConfig, resourceName } from "./config.js";

export interface LoadBalancersResult {
  webappLoadBalancer: digitalocean.LoadBalancer;
  agentLoadBalancer: digitalocean.LoadBalancer;
  certificate: digitalocean.Certificate;
  webappIp: pulumi.Output<string>;
  agentIp: pulumi.Output<string>;
}

export interface LoadBalancersArgs {
  vpcId: pulumi.Input<string>;
  webappDropletIds: pulumi.Input<pulumi.Input<number>[]>;
  agentDropletIds: pulumi.Input<pulumi.Input<number>[]>;
  adminDropletIds: pulumi.Input<pulumi.Input<number>[]>;
}

/**
 * Create separate load balancers for webapp and agent with SSL certificate
 */
export function createLoadBalancers(
  config: InfraConfig,
  args: LoadBalancersArgs
): LoadBalancersResult {
  // Let's Encrypt Certificate (shared between both load balancers)
  const certificate = new digitalocean.Certificate(
    resourceName(config, "cert"),
    {
      name: resourceName(config, "cert"),
      type: "lets_encrypt",
      domains: [
        config.domainName,
        `www.${config.domainName}`,
        `api.${config.domainName}`,
        `agent.${config.domainName}`,
        `admin.${config.domainName}`,
      ],
    }
  );

  // Webapp Load Balancer (for domainName, www, api)
  // Only webapp droplets - admin has its own routing
  const webappLoadBalancer = new digitalocean.LoadBalancer(
    resourceName(config, "lb-webapp"),
    {
      name: resourceName(config, "lb-webapp"),
      region: config.region,
      size: "lb-small",
      vpcUuid: args.vpcId,
      redirectHttpToHttps: true,
      enableProxyProtocol: false,

      // Forwarding rules
      forwardingRules: [
        // HTTPS
        {
          entryPort: 443,
          entryProtocol: "https",
          targetPort: 80,
          targetProtocol: "http",
          certificateName: certificate.name,
        },
        // HTTP (will redirect to HTTPS)
        {
          entryPort: 80,
          entryProtocol: "http",
          targetPort: 80,
          targetProtocol: "http",
        },
      ],

      // Health check
      healthcheck: {
        port: 80,
        protocol: "http",
        path: "/health",
        checkIntervalSeconds: 10,
        responseTimeoutSeconds: 5,
        healthyThreshold: 3,
        unhealthyThreshold: 3,
      },

      // Sticky sessions for webapp
      stickySessions: {
        type: "cookies",
        cookieName: "DO-LB-WEBAPP",
        cookieTtlSeconds: 300,
      },

      // Webapp droplets only
      dropletIds: args.webappDropletIds,
    }
  );

  // Agent Load Balancer (for agent.domainName - WebSocket server)
  const agentLoadBalancer = new digitalocean.LoadBalancer(
    resourceName(config, "lb-agent"),
    {
      name: resourceName(config, "lb-agent"),
      region: config.region,
      size: "lb-small",
      vpcUuid: args.vpcId,
      redirectHttpToHttps: true,
      enableProxyProtocol: false,

      // Forwarding rules
      forwardingRules: [
        // HTTPS (supports WebSocket wss://)
        {
          entryPort: 443,
          entryProtocol: "https",
          targetPort: 80,
          targetProtocol: "http",
          certificateName: certificate.name,
        },
        // HTTP (will redirect to HTTPS)
        {
          entryPort: 80,
          entryProtocol: "http",
          targetPort: 80,
          targetProtocol: "http",
        },
      ],

      // Health check
      healthcheck: {
        port: 80,
        protocol: "http",
        path: "/health",
        checkIntervalSeconds: 10,
        responseTimeoutSeconds: 5,
        healthyThreshold: 3,
        unhealthyThreshold: 3,
      },

      // Sticky sessions for WebSocket connections
      stickySessions: {
        type: "cookies",
        cookieName: "DO-LB-AGENT",
        cookieTtlSeconds: 3600, // Longer TTL for WebSocket persistence
      },

      // Agent droplets only
      dropletIds: args.agentDropletIds,
    }
  );

  return {
    webappLoadBalancer,
    agentLoadBalancer,
    certificate,
    webappIp: webappLoadBalancer.ip,
    agentIp: agentLoadBalancer.ip,
  };
}
