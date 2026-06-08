import "dotenv/config"
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL
const sql = postgres(connectionString, {
    ssl: { rejectUnauthorized: false }
})

export default sql