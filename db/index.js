/* eslint-disable camelcase */
require('dotenv').config();
const { Sequelize, DataTypes, DECIMAL, Deferrable } = require('sequelize');

const {
  DATABASE,
  USER_NAME,
  USER_PASSWORD,
  HOST,
  DB_PORT,
} = process.env;

const sequelize = new Sequelize( DATABASE, USER_NAME, USER_PASSWORD, {
  host: HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false
});

//checks for database credentials
sequelize.authenticate()
  .then(() => console.log('connection established'))
  .catch(err => console.error('error', err));

// one to many with posts
const User = sequelize.define('User', {
  username: DataTypes.STRING,
  googleId: DataTypes.STRING,
  thumbnail: DataTypes.STRING,
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  contact: DataTypes.STRING,
  description: DataTypes.STRING,
  rating: DataTypes.INTEGER,
  type: DataTypes.STRING
},
{
  timestamps: true
});


// one to many with posts
const Item = sequelize.define('Item', {
  brand: DataTypes.STRING,
  type: DataTypes.STRING,
  price: DataTypes.INTEGER,
  condition: DataTypes.STRING,
  value: DataTypes.INTEGER,
  availability: DataTypes.BOOLEAN,
  description: DataTypes.STRING,
}, {
  timestamps: true
});

const Post = sequelize.define('Post', {
  rating: DataTypes.INTEGER,
  description: DataTypes.STRING,
}, {
  timestamps: true
});


const ItemImg = sequelize.define('ItemImg', {
  imgUrl: DataTypes.STRING
}, {
  timestamps: true
});


const Reservation = sequelize.define('Reservation', {
  user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
      deferrable: Deferrable.INITIALLY_IMMEDIATE
    }
  },
  item_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Item,
      key: 'id',
      deferrable: Deferrable.INITIALLY_IMMEDIATE
    }
  },
  startDate: DataTypes.INTEGER,
  endDate: DataTypes.INTEGER,
  price: DataTypes.INTEGER,
  total: DataTypes.INTEGER
});


////Associations
Post.belongsTo(Item, {as: 'itemPost', foreignKey: 'itemId'});
Post.belongsTo(User, {as: 'userPost', foreignKey: 'userId'});
Item.belongsTo(User, {as: 'userItem', foreignKey: 'userId'});
ItemImg.belongsTo(Item, {as: 'itemImg', foreignKey: 'itemId'});
////////////////

sequelize.sync({force: false})
  .then(() => User.sync())
  .then(() => Item.sync())
  .then(() => Post.sync())
  .then(() => ItemImg.sync())
  .then(() => Reservation.sync())
  .then(() => addSearchVectors())
  // .then(() => console.log('table synced'))
  .catch((err) => console.error('Sync Error'));

/**
 * ADDING SEARCH VECTORS
 */


// sequelize.transaction((t) => {
const addSearchVectors = (() => {

  const searchables = {
    '"Items"': ['type', 'description'],
    '"Users"': ['name']
  };

  const returnSearchString = (string) => {
    const splitStr = string.split('');
    splitStr.splice(splitStr.length - 1, 0, '_search');
    return splitStr.join('');
  };

  const returnVectorUpdateString = (string) => {
    const splitStr = string.split('');
    splitStr.splice(splitStr.length - 1, 0, '_vector_update');
    return splitStr.join('');
  };

  Promise.all(Object.keys(searchables).map((table) =>
    sequelize.query(`
      ALTER TABLE ${table} ADD COLUMN ${returnSearchString(table)} TSVECTOR;
    `)
      .then(() =>
        sequelize.query(`
          UPDATE ${table} SET ${returnSearchString(table)} = to_tsvector('english', ${searchables[table].join(" || ' ' || ")});
        `)
      ).then(() =>
        sequelize.query(`
          CREATE INDEX ${returnSearchString(table)} ON ${table} USING gin(${returnSearchString(table)});
        `)
      ).then(() =>
        sequelize.query(`
          CREATE TRIGGER ${returnVectorUpdateString(table)}
          BEFORE INSERT OR UPDATE ON ${table}
          FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger(${returnSearchString(table)}, 'pg_catalog.english', ${searchables[table].join(', ')});
        `)
      ).catch(err => console.error(err))
  )
  );
}
);

// search vector:// searchables.forEach(table => {
//   sequelize.query(`
//    ALTER TABLE ${table} ADD COLUMN ${vector} TSVECTOR;
//   `)    .then(sequelize.query(`
//     UPDATE ${table} SET ${vector} = to_tsvector('english', 'each' || 'search' || 'field');
//     `))
// })

module.exports = {
  db: sequelize,
  User,
  ItemImg,
  Reservation,
  Post,
  Item
};