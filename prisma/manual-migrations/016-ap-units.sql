-- The AP courses being taken, and their units as College Board lists them.
--
-- Unit titles and exam weightings are taken from the Course and Exam Descriptions, supplied by
-- the user (this environment's egress proxy blocks collegeboard.org, so they could not be
-- fetched here). Two of these courses are on revised frameworks and do NOT match older
-- material: AP Statistics is 5 units, not the 9 of the pre-revision CED, and AP Computer
-- Science A is 4 units.
--
-- Physics C is one framework split across two exams: Mechanics is units 1-7 and Electricity and
-- Magnetism continues at 8-13. They are stored as two courses, as they are two exams, joined by
-- the `series` column so the tracker can show the sequence whole.
--
-- Four units have no weighting because none was supplied; they are left NULL rather than
-- guessed, and the tracker simply shows no percentage for them.
--
-- ADDITIVE. Requires 015. Run BEFORE deploying the code.
--
-- Idempotent: re-running refreshes titles and weightings (so a CED correction can be applied by
-- editing this file and running it again) and never touches `completedAt`, so ticks survive.

BEGIN;

-- For databases where 015 was run before the series column existed.
ALTER TABLE "ApCourse" ADD COLUMN IF NOT EXISTS "series" TEXT;

INSERT INTO "ApCourse" ("id", "name", "shortName", "series", "position", "createdAt", "updatedAt") VALUES
  ('apc_stats', 'AP Statistics', 'Statistics', NULL, 1, now(), now()),
  ('apc_physc_mech', 'AP Physics C: Mechanics', 'Physics C: Mech', 'AP Physics C', 2, now(), now()),
  ('apc_physc_em', 'AP Physics C: Electricity and Magnetism', 'Physics C: E&M', 'AP Physics C', 3, now(), now()),
  ('apc_world', 'AP World History: Modern', 'World History', NULL, 4, now(), now()),
  ('apc_csa', 'AP Computer Science A', 'CS A', NULL, 5, now(), now()),
  ('apc_macro', 'AP Macroeconomics', 'Macroeconomics', NULL, 6, now(), now())
ON CONFLICT ("id") DO UPDATE SET
  "name"      = EXCLUDED."name",
  "shortName" = EXCLUDED."shortName",
  "series"    = EXCLUDED."series",
  "position"  = EXCLUDED."position",
  "updatedAt" = now();

INSERT INTO "ApUnit" ("id", "courseId", "number", "title", "weighting", "createdAt", "updatedAt") VALUES
  ('apu_stats_1', 'apc_stats', 1, 'Exploring One-Variable Data and Collecting Data', '20%–30%', now(), now()),
  ('apu_stats_2', 'apc_stats', 2, 'Probability, Random Variables, and Probability Distributions', '15%–25%', now(), now()),
  ('apu_stats_3', 'apc_stats', 3, 'Inference for Categorical Data: Proportions', '15%–25%', now(), now()),
  ('apu_stats_4', 'apc_stats', 4, 'Inference for Quantitative Data: Means', '10%–20%', now(), now()),
  ('apu_stats_5', 'apc_stats', 5, 'Regression Analysis', NULL, now(), now()),
  ('apu_physc_mech_1', 'apc_physc_mech', 1, 'Kinematics', '10%–15%', now(), now()),
  ('apu_physc_mech_2', 'apc_physc_mech', 2, 'Force and Translational Dynamics', '20%–25%', now(), now()),
  ('apu_physc_mech_3', 'apc_physc_mech', 3, 'Work, Energy, and Power', '15%–25%', now(), now()),
  ('apu_physc_mech_4', 'apc_physc_mech', 4, 'Linear Momentum', '10%–20%', now(), now()),
  ('apu_physc_mech_5', 'apc_physc_mech', 5, 'Torque and Rotational Dynamics', '10%–15%', now(), now()),
  ('apu_physc_mech_6', 'apc_physc_mech', 6, 'Energy and Momentum of Rotating Systems', '10%–15%', now(), now()),
  ('apu_physc_mech_7', 'apc_physc_mech', 7, 'Oscillations', NULL, now(), now()),
  ('apu_physc_em_8', 'apc_physc_em', 8, 'Electric Charges, Fields, and Gauss''s Law', '15%–25%', now(), now()),
  ('apu_physc_em_9', 'apc_physc_em', 9, 'Electric Potential', '10%–20%', now(), now()),
  ('apu_physc_em_10', 'apc_physc_em', 10, 'Conductors and Capacitors', '10%–15%', now(), now()),
  ('apu_physc_em_11', 'apc_physc_em', 11, 'Electric Circuits', '15%–25%', now(), now()),
  ('apu_physc_em_12', 'apc_physc_em', 12, 'Magnetic Fields and Electromagnetism', '10%–20%', now(), now()),
  ('apu_physc_em_13', 'apc_physc_em', 13, 'Electromagnetic Induction', '10%–20%', now(), now()),
  ('apu_world_1', 'apc_world', 1, 'The Global Tapestry', '8%–10%', now(), now()),
  ('apu_world_2', 'apc_world', 2, 'Networks of Exchange', '8%–10%', now(), now()),
  ('apu_world_3', 'apc_world', 3, 'Land-Based Empires', '12%–15%', now(), now()),
  ('apu_world_4', 'apc_world', 4, 'Transoceanic Interconnections', '12%–15%', now(), now()),
  ('apu_world_5', 'apc_world', 5, 'Revolutions', '12%–15%', now(), now()),
  ('apu_world_6', 'apc_world', 6, 'Consequences of Industrialization', '12%–15%', now(), now()),
  ('apu_world_7', 'apc_world', 7, 'Global Conflict', '8%–10%', now(), now()),
  ('apu_world_8', 'apc_world', 8, 'Cold War and Decolonization', '8%–10%', now(), now()),
  ('apu_world_9', 'apc_world', 9, 'Globalization', NULL, now(), now()),
  ('apu_csa_1', 'apc_csa', 1, 'Using Objects and Methods', '15%–25%', now(), now()),
  ('apu_csa_2', 'apc_csa', 2, 'Selection and Iteration', '25%–35%', now(), now()),
  ('apu_csa_3', 'apc_csa', 3, 'Class Creation', '10%–18%', now(), now()),
  ('apu_csa_4', 'apc_csa', 4, 'Data Collections', '30%–40%', now(), now()),
  ('apu_macro_1', 'apc_macro', 1, 'Basic Economic Concepts', '5%–10%', now(), now()),
  ('apu_macro_2', 'apc_macro', 2, 'Economic Indicators and the Business Cycle', '12%–17%', now(), now()),
  ('apu_macro_3', 'apc_macro', 3, 'National Income and Price Determination', '17%–27%', now(), now()),
  ('apu_macro_4', 'apc_macro', 4, 'Financial Sector', '18%–23%', now(), now()),
  ('apu_macro_5', 'apc_macro', 5, 'Long-Run Consequences of Stabilization Policies', '20%–30%', now(), now()),
  ('apu_macro_6', 'apc_macro', 6, 'Open Economy—International Trade and Finance', NULL, now(), now())
-- Deliberately does NOT touch completedAt: re-running must never un-tick finished work.
ON CONFLICT ("id") DO UPDATE SET
  "title"     = EXCLUDED."title",
  "weighting" = EXCLUDED."weighting",
  "updatedAt" = now();

COMMIT;
