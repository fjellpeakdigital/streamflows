import { redirect } from 'next/navigation';

// Sign-ups are handled through the beta invite flow
export default function SignupPage() {
  redirect('/beta');
}
