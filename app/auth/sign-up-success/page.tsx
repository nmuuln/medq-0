import Link from "next/link";

export default function SignUpSuccessPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: "linear-gradient(135deg, #e0f7fa 0%, #f0fdfd 60%, #ffffff 100%)" }}
    >
      <div className="bg-white rounded-3xl shadow-xl p-12 max-w-md w-full text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "#e0f7fa" }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#06b6d4">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          И-мэйлээ шалгана уу
        </h1>
        
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          Бид таны и-мэйл хаяг руу баталгаажуулах холбоос илгээлээ. 
          И-мэйлээ шалгаж, холбоос дээр дарна уу.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-8">
          <p className="text-sm text-gray-400">
            И-мэйл ирээгүй бол spam хавтсаа шалгана уу
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 text-cyan-600 font-semibold hover:underline"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}
