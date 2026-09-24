import { DataTypes } from 'sequelize';
import type { Migration } from '../migrate.js';

// passwordHash is NOT NULL, so this fails if users already has rows.
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('users', 'role', {
    type: DataTypes.ENUM('USER', 'ADMIN'),
    allowNull: false,
    defaultValue: 'USER',
  });
  await queryInterface.addColumn('users', 'passwordHash', {
    type: DataTypes.STRING,
    allowNull: false,
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('users', 'passwordHash');
  await queryInterface.removeColumn('users', 'role');
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
};
