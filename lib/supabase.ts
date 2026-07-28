import { createClient } from '@supabase/supabase-js'

// .env.local 파일에 적어둔 주소와 키를 가져옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Supabase와 통신하는 연결 객체를 만들어 수출(export)합니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)