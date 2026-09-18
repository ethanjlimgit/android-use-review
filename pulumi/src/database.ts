import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import { InfraConfig, resourceName, commonTags } from "./config.js";

export interface DatabaseResult {
  cluster: digitalocean.DatabaseCluster;
  database: digitalocean.DatabaseDb;
  user: digitalocean.DatabaseUser;
  connectionPool: digitalocean.DatabaseConnectionPool;
  firewall: digitalocean.DatabaseFirewall;
  connectionString: pulumi.Output<string>;
  privateConnectionString: pulumi.Output<string>;
  poolConnectionString: pulumi.Output<string>;
  adminConnectionString: pulumi.Output<string>;
}

export interface DatabaseArgs {
  vpcId: pulumi.Input<string>;
}

/**
 * Create managed PostgreSQL database with connection pooling
 */
export function createDatabase(
  config: InfraConfig,
  args: DatabaseArgs
): DatabaseResult {
  // PostgreSQL Cluster
  const cluster = new digitalocean.DatabaseCluster(
    resourceName(config, "db"),
    {
      name: resourceName(config, "db"),
      engine: "pg",
      version: "16",
      size: config.dbSize,
      region: config.region,
      nodeCount: config.dbNodeCount,
      privateNetworkUuid: args.vpcId,

      // Maintenance window - Sunday 4 AM
      maintenanceWindows: [
        {
          day: "sunday",
          hour: "04:00:00",
        },
      ],

      tags: [...commonTags(config), "database"],
    }
  );

  // Application Database
  const database = new digitalocean.DatabaseDb(resourceName(config, "app-db"), {
    clusterId: cluster.id,
    name: config.projectName,
  });

  // Application User
  const user = new digitalocean.DatabaseUser(resourceName(config, "app-user"), {
    clusterId: cluster.id,
    name: "androiduse",
  });

  // Connection Pool for better performance
  const connectionPool = new digitalocean.DatabaseConnectionPool(
    resourceName(config, "pool"),
    {
      clusterId: cluster.id,
      name: `${config.projectName}-pool`,
      mode: "transaction",
      size: 20,
      dbName: database.name,
      user: user.name,
    }
  );

  // Firewall - restrict access
  const firewall = new digitalocean.DatabaseFirewall(
    resourceName(config, "db-fw"),
    {
      clusterId: cluster.id,
      rules: [
        // Allow from backend droplets
        {
          type: "tag",
          value: `androiduse-${config.environment}-backend`,
        },
        // Allow from frontend droplets
        {
          type: "tag",
          value: `androiduse-${config.environment}-frontend`,
        },
      ],
    }
  );

  // Build connection strings (schema matches username)
  const connectionString = pulumi.interpolate`postgresql://${user.name}:${user.password}@${cluster.host}:${cluster.port}/${database.name}?sslmode=no-verify&schema=${user.name}&schema=public`;

  const privateConnectionString = pulumi.interpolate`postgresql://${user.name}:${user.password}@${cluster.privateHost}:${cluster.port}/${database.name}?sslmode=no-verify&schema=${user.name}&schema=public`;

  const poolConnectionString = pulumi.interpolate`postgresql://${user.name}:${user.password}@${connectionPool.host}:${connectionPool.port}/${connectionPool.name}?sslmode=no-verify&schema=${user.name}&schema=public`;

  // Admin connection string for schema setup (uses doadmin)
  const adminConnectionString = pulumi.interpolate`postgresql://doadmin:${cluster.password}@${cluster.host}:${cluster.port}/${database.name}?sslmode=require`;

  return {
    cluster,
    database,
    user,
    connectionPool,
    firewall,
    connectionString,
    privateConnectionString,
    poolConnectionString,
    adminConnectionString,
  };
}
