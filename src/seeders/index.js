require('dotenv').config()
async function runSeeders() {
    await require('../config/database')()

  await Promise.all([

      await require('./RoleType').roleTypeSeeder(),
      await require('./Role').roleSeeder(),
      await require('./User').userSeeder()
  ])
}
runSeeders().then(res=> process.exit() )
