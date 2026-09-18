import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import { InfraConfig, resourceName } from "./config.js";

export interface DnsResult {
  rootRecord: digitalocean.DnsRecord;
  wwwRecord: digitalocean.DnsRecord;
  apiRecord: digitalocean.DnsRecord;
  agentRecord: digitalocean.DnsRecord;
  adminRecord: digitalocean.DnsRecord;
}

export interface DnsArgs {
  rootDomain: string;
  subdomainPrefix: string;
  frontendLoadBalancerIp: pulumi.Input<string>;
  backendLoadBalancerIp: pulumi.Input<string>;
  adminIp: pulumi.Input<string>;
}

/**
 * Helper to create record name with subdomain prefix
 * e.g., prefix="dev", name="api" => "api.dev"
 *       prefix="", name="api" => "api"
 *       prefix="dev", name="@" => "dev"
 *       prefix="", name="@" => "@"
 */
function recordName(prefix: string, name: string): string {
  if (name === "@") {
    return prefix || "@";
  }
  return prefix ? `${name}.${prefix}` : name;
}

/**
 * Create DNS records pointing to frontend/backend load balancers
 */
export function createDnsRecords(
  config: InfraConfig,
  args: DnsArgs
): DnsResult {
  const { rootDomain, subdomainPrefix, frontendLoadBalancerIp, backendLoadBalancerIp } = args;

  // Root record (e.g., "dev" for dev.androiduse.com, "@" for androiduse.com)
  // Points to frontend load balancer
  const rootRecord = new digitalocean.DnsRecord(
    resourceName(config, "dns-root"),
    {
      domain: rootDomain,
      type: "A",
      name: recordName(subdomainPrefix, "@"),
      value: frontendLoadBalancerIp,
      ttl: 300,
    }
  );

  // www subdomain (e.g., "www.dev" for www.dev.androiduse.com)
  // Points to frontend load balancer
  const wwwRecord = new digitalocean.DnsRecord(
    resourceName(config, "dns-www"),
    {
      domain: rootDomain,
      type: "A",
      name: recordName(subdomainPrefix, "www"),
      value: frontendLoadBalancerIp,
      ttl: 300,
    }
  );

  // API subdomain (e.g., "api.dev" for api.dev.androiduse.com)
  // Points to frontend load balancer (Next.js API routes)
  const apiRecord = new digitalocean.DnsRecord(
    resourceName(config, "dns-api"),
    {
      domain: rootDomain,
      type: "A",
      name: recordName(subdomainPrefix, "api"),
      value: frontendLoadBalancerIp,
      ttl: 300,
    }
  );

  // Agent subdomain (e.g., "agent.dev" for agent.dev.androiduse.com)
  // Points to backend load balancer (WebSocket server)
  const agentRecord = new digitalocean.DnsRecord(
    resourceName(config, "dns-agent"),
    {
      domain: rootDomain,
      type: "A",
      name: recordName(subdomainPrefix, "agent"),
      value: backendLoadBalancerIp,
      ttl: 300,
    }
  );

  // Admin subdomain (e.g., "admin.dev" for admin.dev.androiduse.com)
  // Points directly to admin droplet (not load balanced)
  const adminRecord = new digitalocean.DnsRecord(
    resourceName(config, "dns-admin"),
    {
      domain: rootDomain,
      type: "A",
      name: recordName(subdomainPrefix, "admin"),
      value: args.adminIp,
      ttl: 300,
    }
  );

  return {
    rootRecord,
    wwwRecord,
    apiRecord,
    agentRecord,
    adminRecord,
  };
}
