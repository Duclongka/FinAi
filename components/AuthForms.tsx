
import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut
} from 'firebase/auth';
import { auth } from '../services/firebaseService';

interface AuthFormsProps {
  onSuccess: () => void;
  t: any; // Translation object passed from parent
}

const AuthForms: React.FC<AuthFormsProps> = ({ onSuccess, t }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error(t.confirm_delete_msg || "Mật khẩu xác nhận không khớp");
        }
        
        // 1. Tạo tài khoản
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // 2. Cập nhật profile tên hiển thị
        await updateProfile(userCredential.user, { displayName: username });
        
        // 3. Gửi email xác thực lần đầu
        await sendEmailVerification(userCredential.user);
        
        setRegisteredEmail(email);
        setIsVerifying(true);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // 4. Kiểm tra trạng thái xác minh email
        if (!userCredential.user.emailVerified) {
          setRegisteredEmail(userCredential.user.email || email);
          
          // Tự động gửi lại email nếu chưa xác minh
          await sendEmailVerification(userCredential.user);
          
          setIsVerifying(true);
          setLoading(false);
          return;
        }
        
        // Đã xác minh thành công
        onSuccess();
      }
    } catch (err: any) {
      let msg = "Lỗi";
      if (err.code === 'auth/email-already-in-use') msg = "Email đã được đăng ký.";
      else if (err.code === 'auth/invalid-credential') msg = "Email hoặc mật khẩu không đúng.";
      else if (err.code === 'auth/weak-password') msg = "Mật khẩu quá yếu.";
      else if (err.code === 'auth/user-not-found') msg = "Không tìm thấy tài khoản.";
      else if (err.code === 'auth/wrong-password') msg = "Sai mật khẩu.";
      else if (err.code === 'auth/invalid-email') msg = "Email không hợp lệ.";
      else if (err.message) msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendLoading) return;
    setResendLoading(true);
    try {
      // Firebase yêu cầu user phải đang login (session hiện tại) để gửi lại email xác thực
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        alert("Yêu cầu xác thực mới đã được gửi! Vui lòng kiểm tra hộp thư của bạn.");
      } else {
        // Nếu mất session, yêu cầu họ quay lại đăng nhập để hệ thống nhận diện user
        setIsVerifying(false);
        setIsSignUp(false);
        setError("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để nhận email xác thực mới.");
      }
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        alert("Bạn đã yêu cầu quá nhanh. Vui lòng đợi một lát rồi thử lại.");
      } else {
        alert("Không thể gửi lại email vào lúc này. Vui lòng thử lại sau.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user.emailVerified) {
        onSuccess();
      } else {
        await sendEmailVerification(result.user);
        setRegisteredEmail(result.user.email || '');
        setIsVerifying(true);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError("Đăng nhập Google thất bại.");
      }
    }
  };

  // Màn hình thông báo xác thực
  if (isVerifying) {
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6">
        <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] p-9 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col items-center text-center relative border border-slate-100">
          <button 
            onClick={() => {
              setIsVerifying(false);
              signOut(auth); // Xóa session tạm để tránh lỗi logic
            }}
            className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-20 h-20 bg-emerald-100/50 rounded-full flex items-center justify-center mb-7 border border-emerald-100 shadow-inner">
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="space-y-3 mb-6">
            <p className="text-[11px] font-medium text-slate-400 leading-relaxed px-4">
              Chúng tôi đã gửi email xác thực đến:
              <br />
              <span className="text-blue-900 font-black block mt-2 break-all text-[12px]">{registeredEmail}</span>
            </p>
            <p className="text-[11px] font-bold text-slate-500 mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 leading-normal">
              Vui lòng mở email của bạn để xác thực và quay lại ứng dụng để đăng nhập sau khi đã xác thực thành công.
            </p>
          </div>

          <button 
            onClick={handleResendEmail}
            disabled={resendLoading}
            className="text-blue-900 font-bold italic text-[11px] mb-5 hover:underline active:opacity-60 transition-all"
          >
            {resendLoading ? "Đang gửi lại..." : "Gửi lại email xác thực"}
          </button>

          <button
            onClick={() => {
              setIsVerifying(false);
              setIsSignUp(false);
              setError('');
              signOut(auth); // Buộc đăng nhập lại để Firebase cập nhật trạng thái emailVerified
            }}
            className="w-[75%] h-[44px] rounded-2xl bg-blue-600 text-white font-black text-[12px] uppercase tracking-widest shadow-[0_4px_10px_rgba(37,99,235,0.2)] active:scale-95 transition-all hover:bg-blue-700"
          >
            Đăng nhập
          </button>
          
          <p className="mt-8 text-[11px] text-slate-400 italic">
            Kiểm tra cả hòm thư rác (spam)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#ebf0f3] p-6 overflow-y-auto">
      <div className="w-full max-w-[360px] p-7 rounded-[2.5rem] nm-flat animate-in zoom-in-95 duration-300 border border-white/40">
        <h2 className="text-[22px] font-bold text-[#424d5e] text-center mb-7 tracking-tight">
          {isSignUp ? (t.register_btn || 'Sign Up') : (t.login_btn || 'Sign In')}
        </h2>

        {error && (
          <div className="mb-5 p-2.5 nm-inset rounded-xl text-rose-500 text-[9px] font-bold text-center uppercase tracking-widest bg-rose-50/20 animate-in fade-in slide-in-from-top-1 border border-rose-100/30">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] opacity-40">👤</div>
              <input
                required
                type="text"
                placeholder={t.onboarding_name ? t.onboarding_name.toLowerCase() : "full name"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-[48px] pl-11 pr-5 rounded-full nm-inset text-[#5c6777] text-[12px] font-medium outline-none transition-all placeholder:text-[#b0bac9] border-none bg-transparent"
              />
            </div>
          )}

          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] opacity-40">✉️</div>
            <input
              required
              type="email"
              placeholder={t.auth_email_label ? t.auth_email_label.toLowerCase() : "email address"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-[48px] pl-11 pr-5 rounded-full nm-inset text-[#5c6777] text-[12px] font-medium outline-none transition-all placeholder:text-[#b0bac9] border-none bg-transparent"
            />
          </div>

          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] opacity-40">🔒</div>
            <input
              required
              type="password"
              placeholder={t.auth_password_label ? t.auth_password_label.toLowerCase() : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-[48px] pl-11 pr-5 rounded-full nm-inset text-[#5c6777] text-[12px] font-medium outline-none transition-all placeholder:text-[#b0bac9] border-none bg-transparent"
            />
          </div>

          {isSignUp && (
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] opacity-40">🔒</div>
              <input
                required
                type="password"
                placeholder={t.auth_confirm_password_label ? t.auth_confirm_password_label.toLowerCase() : "confirm password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-[48px] pl-11 pr-5 rounded-full nm-inset text-[#5c6777] text-[12px] font-medium outline-none transition-all placeholder:text-[#b0bac9] border-none bg-transparent"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[48px] rounded-full bg-[#10b981] text-white font-bold text-[12px] uppercase tracking-[0.12em] mt-3 shadow-[0_4px_12px_rgba(16,185,129,0.2)] active:scale-95 transition-all flex items-center justify-center border-t border-white/20"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (isSignUp ? (t.register_btn || 'REGISTER') : (t.login_btn || 'LOGIN'))}
          </button>
        </form>

        <div className="mt-7 flex flex-col items-center gap-5">
          <div className="flex items-center gap-3 w-full opacity-30">
            <div className="h-[1px] flex-1 bg-[#b0bac9]"></div>
            <span className="text-[8px] font-bold text-[#424d5e] uppercase tracking-[0.1em] px-1">
              {t.auth_or || 'OR LOGIN WITH'}
            </span>
            <div className="h-[1px] flex-1 bg-[#b0bac9]"></div>
          </div>
          
          <button 
            onClick={handleGoogleSignIn}
            className="w-full h-[46px] rounded-full nm-button-white flex items-center justify-center gap-3 text-[#424d5e] text-[11px] font-bold active:scale-95 transition-transform border border-white"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
            {t.auth_google_btn || 'Sign in with Google'}
          </button>

          <p className="text-[#8c98a9] text-[10px] text-center font-semibold mt-1">
            {isSignUp ? (t.auth_have_account || 'Already have an account?') : (t.auth_no_account || 'Not Registered ?')}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-[#10b981] font-bold underline underline-offset-4 decoration-1 ml-1 hover:text-[#059669] transition-colors"
            >
              {isSignUp ? (t.auth_sign_in_now || 'Sign in now') : (t.auth_sign_up_now || 'Create an account')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForms;
