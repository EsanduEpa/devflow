import mongoose from 'mongoose'

export async function connectDatabase(uri: string, databaseName: string) {
  await mongoose.connect(uri, {
    dbName: databaseName,
    serverSelectionTimeoutMS: 10_000,
  })

  return mongoose.connection
}
