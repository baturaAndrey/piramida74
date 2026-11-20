import { pgEnum } from "drizzle-orm/pg-core";

// Значения — строго из specs/piramida-rewrite/data/contracts.md

export const disciplineEnum = pgEnum("discipline", [
  "free_pyramid",
  "combined_pyramid",
  "dynamic_pyramid",
  "moscow_pyramid",
  "free_pyramid_continuation",
  "pool",
  "other",
]);
export const tournamentLevelEnum = pgEnum("tournament_level", [
  "regional_championship",
  "regional_youth",
  "club",
  "other",
]);
export const hallKindEnum = pgEnum("hall_kind", ["common", "vip"]);
export const priceUnitEnum = pgEnum("price_unit", ["per_hour", "fixed", "per_session"]);
export const tariffAudienceEnum = pgEnum("tariff_audience", ["all", "pensioner"]);
export const promotionTargetEnum = pgEnum("promotion_target", [
  "table_rental",
  "menu_category",
  "takeaway",
  "other",
]);
export const measureUnitEnum = pgEnum("measure_unit", ["g", "ml", "l", "pcs"]);
export const setPricingModeEnum = pgEnum("set_pricing_mode", ["per_person", "fixed"]);
export const penaltyKindEnum = pgEnum("penalty_kind", ["dishware", "property"]);
export const leadTypeEnum = pgEnum("lead_type", [
  "callback",
  "booking",
  "promo",
  "calculator",
  "tournament",
]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "in_progress", "done", "spam"]);
export const callbackWindowEnum = pgEnum("callback_window", ["now", "hour", "day", "week"]);
export const articleStatusEnum = pgEnum("article_status", ["draft", "scheduled", "published"]);
export const legalDocTypeEnum = pgEnum("legal_doc_type", ["policy", "consent"]);

export type Discipline = (typeof disciplineEnum.enumValues)[number];
export type TournamentLevel = (typeof tournamentLevelEnum.enumValues)[number];
export type HallKind = (typeof hallKindEnum.enumValues)[number];
export type PriceUnit = (typeof priceUnitEnum.enumValues)[number];
export type TariffAudience = (typeof tariffAudienceEnum.enumValues)[number];
export type PromotionTarget = (typeof promotionTargetEnum.enumValues)[number];
export type MeasureUnit = (typeof measureUnitEnum.enumValues)[number];
export type SetPricingMode = (typeof setPricingModeEnum.enumValues)[number];
export type PenaltyKind = (typeof penaltyKindEnum.enumValues)[number];
export type LeadType = (typeof leadTypeEnum.enumValues)[number];
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
export type CallbackWindow = (typeof callbackWindowEnum.enumValues)[number];
export type ArticleStatus = (typeof articleStatusEnum.enumValues)[number];
export type LegalDocType = (typeof legalDocTypeEnum.enumValues)[number];
