import Link from "next/link";

export default function SignUpSuccessPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: "linear-gradient(135deg, #e0f7fa 0%, #f0fdfd 60%, #ffffff 100%)" }}
    >
      <div className="bg-white rounded-3xl shadow-xl p-12 text-center max-w-md w-full">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "#d1fae5" }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#10b981">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">Бүртгэл амжилттай!</h1>
        <p className="text-gray-500 text-lg mb-8">
          Таны и-мэйл хаяг руу баталгаажуулах линк илгээгдлээ. И-мэйлээ шалгаад линк дээр дарж хаягаа баталгаажуулна уу.
        </p>

        <Link
          href="/auth/login"
          className="inline-block py-4 px-8 rounded-xl text-white font-bold text-lg transition-opacity hover:opacity-90"
          style={{ background: "#06b6d4" }}
        >
          Нэвтрэх хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}
