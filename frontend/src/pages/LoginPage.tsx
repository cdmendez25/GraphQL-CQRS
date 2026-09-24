import { useMutation } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DomainErrors, RequestError } from '../components/DomainErrors';
import { LOGIN_MUTATION, REGISTER_MUTATION } from '../graphql/operations';

const DEMO = [
  { label: 'Paciente · Laura Gómez', email: 'paciente@afirmativepill.co', password: 'Paciente123!' },
  { label: 'Paciente · Andrés Pérez', email: 'paciente2@afirmativepill.co', password: 'Paciente123!' },
  { label: 'Químico farmacéutico', email: 'farmaceutico@afirmativepill.co', password: 'Farmacia123!' },
];

/** La autenticación también es una operación GraphQL (Zero-REST). */
export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const [login, loginState] = useMutation(LOGIN_MUTATION);
  const [register, registerState] = useMutation(REGISTER_MUTATION);

  if (user) return <Navigate to={user.role === 'PHARMACIST' ? '/farmacia' : '/'} replace />;

  const payload = mode === 'login' ? loginState.data?.login : registerState.data?.registerPatient;
  const requestError = mode === 'login' ? loginState.error : registerState.error;
  const busy = loginState.loading || registerState.loading;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result =
      mode === 'login'
        ? (await login({ variables: { input: { email: form.email, password: form.password } } })).data?.login
        : (await register({ variables: { input: form } })).data?.registerPatient;
    if (result?.token && result.user) {
      signIn({ token: result.token, user: result.user });
      navigate(result.user.role === 'PHARMACIST' ? '/farmacia' : '/');
    }
  };

  const set = (name: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [name]: event.target.value }));

  return (
    <section className="auth">
      <form className="card auth-card" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'tab tab-active' : 'tab'} onClick={() => setMode('login')}>
            Iniciar sesión
          </button>
          <button type="button" className={mode === 'register' ? 'tab tab-active' : 'tab'} onClick={() => setMode('register')}>
            Crear cuenta
          </button>
        </div>

        {mode === 'register' && (
          <label className="field">
            <span>Nombre completo</span>
            <input className="input" value={form.fullName} onChange={set('fullName')} required />
          </label>
        )}
        <label className="field">
          <span>Correo</span>
          <input className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={set('password')}
            required
          />
        </label>

        <DomainErrors errors={payload?.errors} />
        <RequestError error={requestError} />

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Enviando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </button>

        {mode === 'login' && (
          <div className="demo">
            <p className="muted small">Cuentas de demostración:</p>
            {DEMO.map((account) => (
              <button
                key={account.email}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setForm((current) => ({ ...current, email: account.email, password: account.password }))}
              >
                {account.label}
              </button>
            ))}
          </div>
        )}
      </form>
    </section>
  );
}
