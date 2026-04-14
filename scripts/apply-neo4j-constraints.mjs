import neo4j from "neo4j-driver";

const URI = process.env.NEO4J_URI;
const USER = process.env.NEO4J_USERNAME;
const PASSWORD = process.env.NEO4J_PASSWORD;

if (!URI || !USER || !PASSWORD) {
  console.error("Missing NEO4J_URI, NEO4J_USERNAME, or NEO4J_PASSWORD");
  process.exit(1);
}

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

const statements = [
  "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
  "CREATE CONSTRAINT org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE",
  "CREATE CONSTRAINT deal_id IF NOT EXISTS FOR (d:Deal) REQUIRE d.id IS UNIQUE",
  "CREATE CONSTRAINT investor_rel_id IF NOT EXISTS FOR (i:InvestorRelationship) REQUIRE i.id IS UNIQUE",
  "CREATE CONSTRAINT interaction_id IF NOT EXISTS FOR (i:Interaction) REQUIRE i.id IS UNIQUE",
  "CREATE CONSTRAINT signal_id IF NOT EXISTS FOR (s:Signal) REQUIRE s.id IS UNIQUE",
  "CREATE CONSTRAINT commitment_id IF NOT EXISTS FOR (c:Commitment) REQUIRE c.id IS UNIQUE",
  "CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
  "CREATE INDEX person_email IF NOT EXISTS FOR (p:Person) ON (p.user_id, p.email)",
  "CREATE INDEX org_domain IF NOT EXISTS FOR (o:Organization) ON (o.user_id, o.domain)",
  "CREATE INDEX interaction_occurred IF NOT EXISTS FOR (i:Interaction) ON (i.user_id, i.occurred_at)",
  "CREATE INDEX deal_stage IF NOT EXISTS FOR (d:Deal) ON (d.user_id, d.stage)",
  "CREATE INDEX investor_stage IF NOT EXISTS FOR (i:InvestorRelationship) ON (i.user_id, i.stage)",
];

const session = driver.session();

try {
  for (const stmt of statements) {
    await session.run(stmt);
    console.log(`OK: ${stmt.substring(0, 70)}...`);
  }
  console.log("\nAll constraints and indexes applied.");
} catch (err) {
  console.error("Failed:", err.message);
  process.exit(1);
} finally {
  await session.close();
  await driver.close();
}
