-- =============================================================
-- HALALina - Mock Student Information System (SIS) - SQL Schema
-- MySQL 8+ compatible (also runs on MariaDB / SQLite with minor edits)
-- Mirrors the Entity Relationship Diagram (ERD) described in the
-- HALALina capstone document Chapter 3 (Methodology).
--
-- Run this file first, then run seed.sql to populate the database.
--
-- Entities:
--   MOCK_STUDENT_SIS   - synthetic student records (220 demo students)
--   VOTER_LOG          - off-chain metadata: who has voted + tx hash
--   CANDIDATE_PROFILE  - election candidates
--   ELECTION_SCHEDULE  - election windows + status
-- =============================================================

DROP DATABASE IF EXISTS halalina_sis;
CREATE DATABASE halalina_sis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE halalina_sis;

-- ----------------------------------------------------------------
-- MOCK_STUDENT_SIS
-- Synthetic student records that replicate the PLMun SIS structure.
-- Data Privacy Act of 2012 (RA 10173) compliant: synthetic + anonymized.
-- ----------------------------------------------------------------
CREATE TABLE MOCK_STUDENT_SIS (
  student_id         VARCHAR(8)    NOT NULL  COMMENT 'Format: 23XXXXXX (8 digits)',
  first_name         VARCHAR(64)   NOT NULL,
  middle_initial     CHAR(1)       NULL,
  last_name          VARCHAR(64)   NOT NULL,
  gender             ENUM('M','F') NOT NULL,
  program            VARCHAR(16)   NOT NULL  COMMENT 'BSIT, BSCS, BSIS, ACT, BSEMCP, BSDS',
  program_full       VARCHAR(128)  NOT NULL,
  year               TINYINT       NOT NULL  COMMENT '1-4',
  section            CHAR(1)       NOT NULL  COMMENT 'A-D',
  email              VARCHAR(128)  NOT NULL,
  pin                CHAR(6)       NOT NULL  COMMENT 'SHA-256 hash of PIN in production',
  eligibility_status ENUM('ELIGIBLE','INELIGIBLE') NOT NULL DEFAULT 'ELIGIBLE',
  has_voted          BOOLEAN       NOT NULL DEFAULT FALSE,
  vote_hash          CHAR(64)      NULL     COMMENT 'tx hash after voting',
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id),
  INDEX idx_eligibility (eligibility_status),
  INDEX idx_program_year (program, year, section)
) ENGINE=InnoDB COMMENT='Mock SIS - 220 synthetic student records';

-- ----------------------------------------------------------------
-- VOTER_LOG
-- Off-chain metadata table - enforces "one person, one vote".
-- Mirrors the VOTER_LOG entity in the capstone ERD.
-- ----------------------------------------------------------------
CREATE TABLE VOTER_LOG (
  log_id              BIGINT       NOT NULL AUTO_INCREMENT,
  student_id          VARCHAR(8)   NOT NULL,
  hashed_voter_id     CHAR(64)     NOT NULL  COMMENT 'SHA-256(salt:student_id)',
  device_fingerprint  VARCHAR(128) NULL,
  ip_address          VARCHAR(45)  NULL,
  verification_token  VARCHAR(128) NULL,
  registration_date   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  has_voted           BOOLEAN      NOT NULL DEFAULT FALSE,
  vote_timestamp      TIMESTAMP    NULL,
  transaction_hash    CHAR(64)     NULL,
  PRIMARY KEY (log_id),
  UNIQUE KEY uq_student (student_id),
  UNIQUE KEY uq_hashed_voter (hashed_voter_id),
  CONSTRAINT fk_voterlog_student
    FOREIGN KEY (student_id) REFERENCES MOCK_STUDENT_SIS(student_id)
) ENGINE=InnoDB COMMENT='Voter session metadata (1:1 with MOCK_STUDENT_SIS)';

-- ----------------------------------------------------------------
-- CANDIDATE_PROFILE
-- Stores all election candidate information.
-- ----------------------------------------------------------------
CREATE TABLE CANDIDATE_PROFILE (
  candidate_id       VARCHAR(8)   NOT NULL,
  election_id        VARCHAR(32)  NOT NULL,
  full_name          VARCHAR(128) NOT NULL,
  running_position   VARCHAR(64)  NOT NULL,
  party_affiliation  VARCHAR(64)  NOT NULL,
  program            VARCHAR(16)  NOT NULL,
  year_section        VARCHAR(8)   NOT NULL,
  platform           JSON         NULL     COMMENT 'Array of platform items',
  credentials        JSON         NULL     COMMENT 'Education, GPA, leadership, achievements',
  credibility        JSON         NULL     COMMENT 'academic/leadership/integrity/community/overall scores',
  PRIMARY KEY (candidate_id),
  INDEX idx_election (election_id),
  INDEX idx_position (running_position)
) ENGINE=InnoDB COMMENT='Election candidate profiles';

-- ----------------------------------------------------------------
-- ELECTION_SCHEDULE
-- Election window configuration - drives smart contract lifecycle.
-- ----------------------------------------------------------------
CREATE TABLE ELECTION_SCHEDULE (
  schedule_id           BIGINT      NOT NULL AUTO_INCREMENT,
  election_id           VARCHAR(32) NOT NULL,
  election_name         VARCHAR(128) NOT NULL,
  start_time            TIMESTAMP   NOT NULL,
  end_time              TIMESTAMP   NOT NULL,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  cluster_department    VARCHAR(64) NOT NULL DEFAULT 'All Colleges',
  smart_contract_address VARCHAR(64) NULL,
  PRIMARY KEY (schedule_id),
  UNIQUE KEY uq_election (election_id)
) ENGINE=InnoDB COMMENT='Election window configuration';

-- =============================================================
-- Done. Run seed.sql next to populate MOCK_STUDENT_SIS.
-- =============================================================
