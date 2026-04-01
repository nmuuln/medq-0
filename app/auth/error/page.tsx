import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: "linear-gradient(135deg, #e0f7fa 0%, #f0fdfd 60%, #ffffff 100%)" }}
    >
      <div className="bg-white rounded-3xl shadow-xl p-12 max-w-md w-full text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "#fee2e2" }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#ef4444">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Алдаа гарлаа
        </h1>
        
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          Нэвтрэх үед алдаа гарлаа. Дахин оролдоно уу эсвэл 
          шинэ хаяг үүсгэнэ үү.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full py-4 rounded-xl text-white font-bold text-lg transition-opacity hover:opacity-90"
            style={{ background: "#06b6d4" }}
          >
            Дахин нэвтрэх
          </Link>
        </div>
      </div>
    </div>
  );
}
