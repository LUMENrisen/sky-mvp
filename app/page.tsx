'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Camera, MapPin } from 'lucide-react'

export default function Home() {
  // 定义状态变量
  const [skies, setSkies] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [user, setUser] = useState<any>(null)

  // 页面加载时执行：1.匿名登录 2.拉取数据
  useEffect(() => {
    async function initAuth() {
      // 尝试获取当前会话，如果没有就匿名登录
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error) setUser(data.user)
      } else {
        setUser(session.user)
      }
    }
    initAuth()
    fetchSkies()
  }, [])

  // 从数据库拉取天空记录，按时间倒序排列
  async function fetchSkies() {
    const { data } = await supabase
      .from('skies')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setSkies(data)
  }

  // 处理图片上传的核心逻辑
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)
      const file = e.target.files?.[0]
      if (!file || !user) return

      // 1. 生成唯一的文件名
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`

      // 2. 上传图片到 Supabase Storage 的 sky-images 桶
      const { error: uploadError } = await supabase.storage
        .from('sky-images')
        .upload(`public/${fileName}`, file)

      if (uploadError) throw uploadError

      // 3. 获取这张图片的公开访问 URL
      const { data: { publicUrl } } = supabase.storage
        .from('sky-images')
        .getPublicUrl(`public/${fileName}`)

      // 4. 把记录存入数据库表
      const { error: dbError } = await supabase.from('skies').insert({
        user_id: user.id,
        image_url: publicUrl,
        location_name: "此刻的抬头", // 暂时写死，后续可以接定位
      })

      if (dbError) {
        console.error("数据库报错详情：", dbError.message, dbError.details, dbError.hint);
        throw new Error(dbError.message); // 抛出一个带具体信息的 Error
      }

      // 5. 上传成功后刷新列表
      fetchSkies()
    } catch (error: any) {
  console.error("完整错误信息:", error)
  alert('上传失败：' + (error.message || JSON.stringify(error)))
}
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-white p-4 pb-32">
      {/* 顶部标题区 */}
      <header className="text-center py-10">
        <h1 className="text-2xl font-light tracking-[0.3em] text-neutral-200">拾空</h1>
        <p className="text-xs text-neutral-500 mt-3 tracking-widest">记录此刻的仰望</p>
      </header>

      {/* 瀑布流展示区 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
        {skies.length === 0 ? (
          <div className="col-span-full text-center text-neutral-600 mt-20">
            这片天空还很安静，拍下第一张吧。
          </div>
        ) : (
          skies.map((sky) => (
            <div key={sky.id} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-800">
              <img 
                src={sky.image_url} 
                alt="sky" 
                className="object-cover w-full h-full transition-transform duration-500 hover:scale-105" 
              />
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-[10px] text-white/70 flex items-center gap-1">
                  <MapPin size={10} /> {sky.location_name}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部悬浮的拍照按钮 */}
      <div className="fixed bottom-10 left-0 right-0 flex justify-center">
        <label className={`bg-white text-black rounded-full p-4 shadow-xl cursor-pointer transition-transform hover:scale-105 active:scale-95 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <Camera size={24} />
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" // 在手机上会直接唤醒后置相机
            className="hidden" 
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>
    </main>
  )
}