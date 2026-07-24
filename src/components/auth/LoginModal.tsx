import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import LoginForm from "./LoginForm";
import brandImg from "@/assets/brand-white.png";

const LoginModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "login" | "request";
}> = ({ open, onOpenChange, initialMode = "login" }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[440px] p-0 overflow-hidden border-0 rounded-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.35)] bg-white/95 backdrop-blur-2xl"
      >
        <div className="px-8 pt-8 pb-2 flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#006367" }}>
            <img src={brandImg} alt="FGB" className="h-8 w-auto" />
          </div>
        </div>
        <div className="px-8 pb-8">
          <LoginForm initialMode={initialMode} theme="light" onSuccess={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;