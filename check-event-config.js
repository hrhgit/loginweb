import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://whnetfkhvuhcavvojjxa.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_iuWGRrjQ5A0eITMAQ-rW_A_b8IG3obf'
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function checkData() {
  // 检查活动基本信息
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', 'a9ec1722-eaa1-4f21-8a5f-c530e4e7129c')
    .single()
    
  if (error) {
    console.error('❌ 查询活动失败:', error.message)
    return
  }
  
  console.log('📋 活动信息:')
  console.log('  标题:', event.title)
  console.log('  所有字段:', Object.keys(event))
  
  // 检查表单字段配置
  const { data: fields, error: fieldsError } = await supabase
    .from('form_fields')
    .select('*')
    .eq('event_id', 'a9ec1722-eaa1-4f21-8a5f-c530e4e7129c')
    .order('order_index')
    
  if (fieldsError) {
    console.error('❌ 查询表单字段失败:', fieldsError.message)
  } else {
    console.log('\n📝 表单字段配置:')
    fields.forEach(field => {
      console.log(`  - ${field.label} (ID: ${field.id})`)
      console.log(`    类型: ${field.type}`)
      if (field.options) {
        console.log('    选项:', JSON.stringify(field.options, null, 2))
      }
    })
  }
  
  // 检查现有报名记录
  const { data: registrations, error: regError } = await supabase
    .from('registrations')
    .select('id, form_response, profiles!inner(username)')
    .eq('event_id', 'a9ec1722-eaa1-4f21-8a5f-c530e4e7129c')
    .limit(2)
    
  if (regError) {
    console.error('❌ 查询报名记录失败:', regError.message)
  } else {
    console.log('\n📊 现有报名记录示例:')
    registrations.forEach((reg, index) => {
      console.log(`  ${index + 1}. ${reg.profiles.username}:`)
      console.log('     表单数据:', JSON.stringify(reg.form_response, null, 4))
    })
  }
}

checkData()