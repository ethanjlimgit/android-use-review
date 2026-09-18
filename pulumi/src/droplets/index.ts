import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import { InfraConfig, resourceName } from "../config.js";

export interface DropletResult {
  droplets: digitalocean.Droplet[];
  ids: pulumi.Output<string>[];
  publicIps: pulumi.Output<string>[];
  privateIps: pulumi.Output<string>[];
  urns: pulumi.Output<string>[];
}

export interface DropletArgs {
  vpcId: pulumi.Input<string>;
  sshKeyIds: pulumi.Input<string>[];
  userData: pulumi.Input<string> | ((index: number) => pulumi.Input<string>);
  role: "agent" | "webapp" | "admin";
  size: string;
  count: number;
  tags: pulumi.Input<string>[];
}

/**
 * Create droplets for agent, webapp, or admin
 */
export function createDroplets(
  config: InfraConfig,
  args: DropletArgs
): DropletResult {
  const droplets: digitalocean.Droplet[] = [];

  for (let i = 0; i < args.count; i++) {
    const suffix = args.count > 1 ? `-${i + 1}` : "";
    const name = resourceName(config, `${args.role}${suffix}`);

    // Generate userData - if it's a function, call it with the index
    const userData = typeof args.userData === 'function'
      ? args.userData(i)
      : args.userData;

    const droplet = new digitalocean.Droplet(name, {
      name,
      region: config.region,
      size: args.size,
      image: "ubuntu-24-04-x64",
      vpcUuid: args.vpcId,
      sshKeys: args.sshKeyIds,
      tags: args.tags,
      monitoring: true,
      backups: config.environment === "production",
      ipv6: true,
      userData: userData,
    });

    droplets.push(droplet);
  }

  return {
    droplets,
    ids: droplets.map((d) => d.id.apply((id) => id.toString())),
    publicIps: droplets.map((d) => d.ipv4Address),
    privateIps: droplets.map((d) => d.ipv4AddressPrivate),
    urns: droplets.map((d) => d.dropletUrn),
  };
}
