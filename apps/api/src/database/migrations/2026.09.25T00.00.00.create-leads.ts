import { DataTypes } from 'sequelize';
import type { Migration } from '../migrate.js';

// Service types are rows, not a Postgres enum or a JSON column on leads: adding or retiring
// one is an INSERT/UPDATE, and lead_service_types can be indexed, joined and foreign-keyed.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('service_types', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
    // Stable key used by the API and clients; never renamed once in use.
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    label: { type: DataTypes.STRING, allowNull: false },
    // Retired types stay for existing leads but are no longer offered.
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.createTable('leads', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    // Stored lowercase by the app; unique so a repeat registration cannot create a second lead.
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    mobile: { type: DataTypes.STRING(20), allowNull: false },
    postcode: { type: DataTypes.STRING(4), allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  // Default dashboard sort: newest first, id as tie-breaker for stable offset pagination.
  await queryInterface.addIndex('leads', ['createdAt', 'id'], { name: 'leads_created_at_id' });

  await queryInterface.createTable('lead_service_types', {
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: 'leads', key: 'id' },
      onDelete: 'CASCADE',
    },
    serviceTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: 'service_types', key: 'id' },
      // A type in use can be retired (active = false) but not deleted.
      onDelete: 'RESTRICT',
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  });
  // The composite primary key (leadId, serviceTypeId) serves lookups by lead; this serves the
  // "leads interested in service X" filter.
  await queryInterface.addIndex('lead_service_types', ['serviceTypeId'], { name: 'lead_service_types_service_type_id' });

  const now = new Date();
  await queryInterface.bulkInsert('service_types', [
    { code: 'delivery', label: 'Delivery', active: true, createdAt: now, updatedAt: now },
    { code: 'pick-up', label: 'Pick-up', active: true, createdAt: now, updatedAt: now },
    { code: 'payment', label: 'Payment', active: true, createdAt: now, updatedAt: now },
  ]);
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('lead_service_types');
  await queryInterface.dropTable('leads');
  await queryInterface.dropTable('service_types');
};
