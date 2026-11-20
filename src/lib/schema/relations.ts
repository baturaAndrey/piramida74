// Relational query API v1 (`db.query.*.findMany({ with })`)
import { relations } from "drizzle-orm";
import { account, session, twoFactor, user } from "./auth";
import { galleries, galleryItems, promotions, tournamentSeries, tournaments } from "./club";
import { articles, articleTags, authors, blogTags, rubrics } from "./content";
import { leads, legalDocuments } from "./leads";
import { mediaAssets } from "./media";
import {
  banquetSetItems,
  banquetSets,
  menuCategories,
  menuItems,
  menuItemVariants,
  priceGroups,
  priceGroupTiers,
} from "./menu";
import { halls, rentalTariffs } from "./pricing";

// --- auth ---
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactors: many(twoFactor),
}));
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, { fields: [twoFactor.userId], references: [user.id] }),
}));

// --- club ---
export const tournamentSeriesRelations = relations(tournamentSeries, ({ many }) => ({
  tournaments: many(tournaments),
}));
export const tournamentsRelations = relations(tournaments, ({ one }) => ({
  series: one(tournamentSeries, {
    fields: [tournaments.seriesId],
    references: [tournamentSeries.id],
  }),
  cover: one(mediaAssets, { fields: [tournaments.coverMediaId], references: [mediaAssets.id] }),
}));
export const promotionsRelations = relations(promotions, ({ one }) => ({
  cover: one(mediaAssets, { fields: [promotions.coverMediaId], references: [mediaAssets.id] }),
  menuCategory: one(menuCategories, {
    fields: [promotions.targetMenuCategoryId],
    references: [menuCategories.id],
  }),
}));
export const galleriesRelations = relations(galleries, ({ many }) => ({
  items: many(galleryItems),
}));
export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  gallery: one(galleries, { fields: [galleryItems.galleryId], references: [galleries.id] }),
  media: one(mediaAssets, { fields: [galleryItems.mediaId], references: [mediaAssets.id] }),
}));

// --- pricing ---
export const hallsRelations = relations(halls, ({ many }) => ({
  tariffs: many(rentalTariffs),
}));
export const rentalTariffsRelations = relations(rentalTariffs, ({ one }) => ({
  hall: one(halls, { fields: [rentalTariffs.hallId], references: [halls.id] }),
}));

// --- menu ---
export const menuCategoriesRelations = relations(menuCategories, ({ one, many }) => ({
  // Самоссылка: relationName связывает parent и children в одно отношение
  parent: one(menuCategories, {
    fields: [menuCategories.parentId],
    references: [menuCategories.id],
    relationName: "category_tree",
  }),
  children: many(menuCategories, { relationName: "category_tree" }),
  items: many(menuItems),
  priceGroup: one(priceGroups, {
    fields: [menuCategories.priceGroupId],
    references: [priceGroups.id],
  }),
}));
export const priceGroupsRelations = relations(priceGroups, ({ many }) => ({
  tiers: many(priceGroupTiers),
}));
export const priceGroupTiersRelations = relations(priceGroupTiers, ({ one }) => ({
  group: one(priceGroups, { fields: [priceGroupTiers.groupId], references: [priceGroups.id] }),
}));
export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
  priceGroup: one(priceGroups, { fields: [menuItems.priceGroupId], references: [priceGroups.id] }),
  image: one(mediaAssets, { fields: [menuItems.imageMediaId], references: [mediaAssets.id] }),
  variants: many(menuItemVariants),
}));
export const menuItemVariantsRelations = relations(menuItemVariants, ({ one }) => ({
  item: one(menuItems, { fields: [menuItemVariants.itemId], references: [menuItems.id] }),
}));
export const banquetSetsRelations = relations(banquetSets, ({ one, many }) => ({
  cover: one(mediaAssets, { fields: [banquetSets.coverMediaId], references: [mediaAssets.id] }),
  items: many(banquetSetItems),
}));
export const banquetSetItemsRelations = relations(banquetSetItems, ({ one }) => ({
  set: one(banquetSets, { fields: [banquetSetItems.setId], references: [banquetSets.id] }),
  variant: one(menuItemVariants, {
    fields: [banquetSetItems.menuItemVariantId],
    references: [menuItemVariants.id],
  }),
}));

// --- leads ---
export const leadsRelations = relations(leads, ({ one }) => ({
  promotion: one(promotions, { fields: [leads.promotionId], references: [promotions.id] }),
  tournament: one(tournaments, { fields: [leads.tournamentId], references: [tournaments.id] }),
  consentDocument: one(legalDocuments, {
    fields: [leads.consentDocumentId],
    references: [legalDocuments.id],
  }),
}));

// --- blog ---
export const authorsRelations = relations(authors, ({ one, many }) => ({
  photo: one(mediaAssets, { fields: [authors.photoMediaId], references: [mediaAssets.id] }),
  articles: many(articles),
}));
export const rubricsRelations = relations(rubrics, ({ many }) => ({
  articles: many(articles),
}));
export const blogTagsRelations = relations(blogTags, ({ many }) => ({
  articleTags: many(articleTags),
}));
export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(authors, { fields: [articles.authorId], references: [authors.id] }),
  rubric: one(rubrics, { fields: [articles.rubricId], references: [rubrics.id] }),
  cover: one(mediaAssets, { fields: [articles.coverMediaId], references: [mediaAssets.id] }),
  tags: many(articleTags),
}));
export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, { fields: [articleTags.articleId], references: [articles.id] }),
  tag: one(blogTags, { fields: [articleTags.tagId], references: [blogTags.id] }),
}));
