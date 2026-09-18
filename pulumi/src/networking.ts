import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import { InfraConfig, resourceName } from "./config.js";

export interface NetworkingResult {
  vpc: digitalocean.Vpc;
  backendFirewall: digitalocean.Firewall;
  frontendFirewall: digitalocean.Firewall;
  projectTag: digitalocean.Tag;
  envTag: digitalocean.Tag;
  backendTag: digitalocean.Tag;
  frontendTag: digitalocean.Tag;
  combinedBackendTag: digitalocean.Tag;
  combinedFrontendTag: digitalocean.Tag;
  domain?: digitalocean.Domain;
}

/**
 * Create networking resources: VPC, Firewalls, Domain
 */
export function createNetworking(config: InfraConfig): NetworkingResult {
  // VPC for private networking
  const vpc = new digitalocean.Vpc(resourceName(config, "vpc"), {
    name: resourceName(config, "vpc"),
    region: config.region,
    ipRange: config.vpcIpRange,
    description: `VPC for ${config.projectName} ${config.environment}`,
  });

  // Create tags explicitly (must exist before firewalls reference them)
  const projectTag = new digitalocean.Tag(resourceName(config, "project-tag"), {
    name: config.projectName,
  });

  const envTag = new digitalocean.Tag(resourceName(config, "env-tag"), {
    name: config.environment,
  });

  const backendTag = new digitalocean.Tag(resourceName(config, "backend-tag"), {
    name: "backend",
  });

  const frontendTag = new digitalocean.Tag(resourceName(config, "frontend-tag"), {
    name: "frontend",
  });

  // Combined tags for database firewall
  const combinedBackendTag = new digitalocean.Tag(
    resourceName(config, "combined-backend-tag"),
    {
      name: `${config.projectName}-${config.environment}-backend`,
    }
  );

  const combinedFrontendTag = new digitalocean.Tag(
    resourceName(config, "combined-frontend-tag"),
    {
      name: `${config.projectName}-${config.environment}-frontend`,
    }
  );

  // Backend Firewall
  const backendFirewall = new digitalocean.Firewall(
    resourceName(config, "backend-fw"),
    {
      name: resourceName(config, "backend-fw"),
      tags: [projectTag.name, envTag.name, backendTag.name],

      // Inbound rules
      inboundRules: [
        // SSH
        {
          protocol: "tcp",
          portRange: "22",
          sourceAddresses: ["0.0.0.0/0", "::/0"],
        },
        // HTTP
        {
          protocol: "tcp",
          portRange: "80",
          sourceAddresses: ["0.0.0.0/0", "::/0"],
        },
        // HTTPS
        {
          protocol: "tcp",
          portRange: "443",
          sourceAddresses: ["0.0.0.0/0", "::/0"],
        },
        // App port from VPC only
        {
          protocol: "tcp",
          portRange: "8000",
          sourceAddresses: [vpc.ipRange],
        },
        // ICMP
        {
          protocol: "icmp",
          sourceAddresses: ["0.0.0.0/0", "::/0"],
        },
      ],

      // Outbound rules - allow all
      outboundRules: [
        {
          protocol: "tcp",
          portRange: "1-65535",
          destinationAddresses: ["0.0.0.0/0", "::/0"],
        },
        {
          protocol: "udp",
          portRange: "1-65535",
          destinationAddresses: ["0.0.0.0/0", "::/0"],
        },
        {
          protocol: "icmp",
          destinationAddresses: ["0.0.0.0/0", "::/0"],
        },
      ],
    }
  );

  // Frontend Firewall
  const frontendFirewall = new digitalocean.Firewall(
    resourceName(config, "frontend-fw"),
    {
      name: resourceName(config, "frontend-fw"),
      tags: [projectTag.name, envTag.name, frontendTag.name],

      inboundRules: [
        // SSH
        {
          protocol: "tcp",
          portRange: "22",
          sourceAddresses: ["0.0.0.0/0", "::/0"],
        },
        // HTTP
        {
          protocol: "tcp",
          portRange: "80",
          sourceAddresses: ["0.0.0.0/0", "::/0"],
        },
        // HTTPS
        {
          protocol: "tcp",
          portRange: "443",
          sourceAddresses: ["0.0.0.0/0", "::/0"],
        },
        // Next.js ports from VPC
        {
          protocol: "tcp",
          portRange: "3000-3001",
          sourceAddresses: [vpc.ipRange],
        },
        // ICMP
        {
          protocol: "icmp",
          sourceAddresses: ["0.0.0.0/0", "::/0"],
        },
      ],

      outboundRules: [
        {
          protocol: "tcp",
          portRange: "1-65535",
          destinationAddresses: ["0.0.0.0/0", "::/0"],
        },
        {
          protocol: "udp",
          portRange: "1-65535",
          destinationAddresses: ["0.0.0.0/0", "::/0"],
        },
        {
          protocol: "icmp",
          destinationAddresses: ["0.0.0.0/0", "::/0"],
        },
      ],
    }
  );

  // Domain (optional) - look up existing domain in DigitalOcean DNS
  // The domain must already exist in your DigitalOcean account
  let domain: digitalocean.Domain | undefined;
  if (config.manageDns) {
    // Use getDomain to reference existing domain (don't create a new one)
    const existingDomain = digitalocean.getDomainOutput({
      name: config.rootDomain,
    });
    // We don't need to store the domain resource since we're just referencing it
    // The DNS records will use config.rootDomain directly
  }

  return {
    vpc,
    backendFirewall,
    frontendFirewall,
    projectTag,
    envTag,
    backendTag,
    frontendTag,
    combinedBackendTag,
    combinedFrontendTag,
    domain,
  };
}
