// Startup Edge v1 Neo4j constraints
// From DATA_MODEL.md — apply manually to Neo4j Aura instance

// Uniqueness constraints on node ids
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT deal_id IF NOT EXISTS FOR (d:Deal) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT investor_rel_id IF NOT EXISTS FOR (i:InvestorRelationship) REQUIRE i.id IS UNIQUE;
CREATE CONSTRAINT interaction_id IF NOT EXISTS FOR (i:Interaction) REQUIRE i.id IS UNIQUE;
CREATE CONSTRAINT signal_id IF NOT EXISTS FOR (s:Signal) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT commitment_id IF NOT EXISTS FOR (c:Commitment) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;

// Composite indexes for common lookups (user_id scoped)
CREATE INDEX person_email IF NOT EXISTS FOR (p:Person) ON (p.user_id, p.email);
CREATE INDEX org_domain IF NOT EXISTS FOR (o:Organization) ON (o.user_id, o.domain);
CREATE INDEX interaction_occurred IF NOT EXISTS FOR (i:Interaction) ON (i.user_id, i.occurred_at);
CREATE INDEX deal_stage IF NOT EXISTS FOR (d:Deal) ON (d.user_id, d.stage);
CREATE INDEX investor_stage IF NOT EXISTS FOR (i:InvestorRelationship) ON (i.user_id, i.stage);
