import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LoginPageClient from '@/app/login/LoginPageClient';
const mockSignIn = jest.fn();
const mockRouter = {push:jest.fn(),replace:jest.fn(),refresh:jest.fn()};
jest.mock('next/navigation',()=>({useRouter:()=>mockRouter,useSearchParams:()=>new URLSearchParams()}));
jest.mock('@/components/AuthProvider',()=>({useAuth:()=>({signIn:mockSignIn,user:null,isAuthReady:true,isRoleReady:true,loading:false})}));
beforeEach(()=>{mockSignIn.mockReset();Object.defineProperty(navigator,'onLine',{configurable:true,value:true});});
it('labels resolve to the fields and password visibility toggles without changing the value',()=>{
 render(<LoginPageClient />);
 const password=screen.getByLabelText('비밀번호',{exact:true});
 fireEvent.change(password,{target:{value:'synthetic-only'}});
 expect(password.type).toBe('password');
 fireEvent.click(screen.getByRole('button',{name:'비밀번호 보기'}));
 expect(password.type).toBe('text');expect(password.value).toBe('synthetic-only');
 fireEvent.click(screen.getByRole('button',{name:'비밀번호 숨기기'}));expect(password.type).toBe('password');
});
it.each([
 ['invalid_credentials','이메일 또는 비밀번호를 확인해 주세요.'],
 ['unexpected_code','로그인하지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.'],
])('shows a safe Korean action for %s',async(code,expected)=>{
 mockSignIn.mockRejectedValue({code,message:'RAW INTERNAL ERROR'});
 render(<LoginPageClient />);
 fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});
 fireEvent.change(screen.getByLabelText('비밀번호',{exact:true}),{target:{value:'synthetic'}});
 fireEvent.click(screen.getByRole('button',{name:'로그인',exact:true}));
 expect((await screen.findByRole('alert')).textContent).toBe(expected);
 expect(screen.queryByText('RAW INTERNAL ERROR')).toBeNull();
});
