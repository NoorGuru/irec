export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0A0F1A] flex flex-col">
      {children}
    </div>
  )
}
