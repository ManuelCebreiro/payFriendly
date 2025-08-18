import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '@/components/layout';
import { Button, Card, Input, useToast } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { UserCircleIcon, KeyIcon } from '@heroicons/react/24/outline';

// Esquemas de validación
const profileSchema = z.object({
  full_name: z.string().min(1, 'El nombre es requerido'),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, 'La contraseña actual es requerida'),
  new_password: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Formulario de perfil
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
    },
  });

  // Formulario de contraseña
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Actualizar perfil
  const onSubmitProfile = async (data: ProfileFormData) => {
    try {
      setIsUpdatingProfile(true);
      await authApi.updateProfile(data);
      await refreshUser();
      addToast({
        type: 'success',
        title: 'Éxito',
        message: 'Perfil actualizado exitosamente',
      });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.detail || 'Error al actualizar el perfil',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Cambiar contraseña
  const onSubmitPassword = async (data: PasswordFormData) => {
    try {
      setIsChangingPassword(true);
      await authApi.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      resetPassword();
      addToast({
        type: 'success',
        title: 'Éxito',
        message: 'Contraseña cambiada exitosamente',
      });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.detail || 'Error al cambiar la contraseña',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Actualizar valores por defecto cuando cambie el usuario
  React.useEffect(() => {
    if (user) {
      resetProfile({ full_name: user.full_name });
    }
  }, [user, resetProfile]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
          <p className="mt-2 text-gray-600">
            Gestiona tu perfil y configuración de cuenta
          </p>
        </div>

        <div className="space-y-8">
          {/* Sección de Perfil */}
          <Card>
            <Card.Header>
              <div className="flex items-center space-x-3">
                <UserCircleIcon className="w-6 h-6 text-primary-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Información del Perfil
                  </h2>
                  <p className="text-sm text-gray-600">
                    Actualiza tu información personal
                  </p>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Nombre Completo"
                    placeholder="Tu nombre completo"
                    error={profileErrors.full_name?.message}
                    {...registerProfile('full_name')}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-gray-50"
                    helpText="El email no se puede cambiar"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isUpdatingProfile}
                  >
                    Actualizar Perfil
                  </Button>
                </div>
              </form>
            </Card.Body>
          </Card>

          {/* Sección de Contraseña */}
          <Card>
            <Card.Header>
              <div className="flex items-center space-x-3">
                <KeyIcon className="w-6 h-6 text-primary-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Cambiar Contraseña
                  </h2>
                  <p className="text-sm text-gray-600">
                    Actualiza tu contraseña para mantener tu cuenta segura
                  </p>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-6">
                <div className="space-y-4">
                  <Input
                    label="Contraseña Actual"
                    type="password"
                    placeholder="Tu contraseña actual"
                    error={passwordErrors.current_password?.message}
                    {...registerPassword('current_password')}
                  />
                  <Input
                    label="Nueva Contraseña"
                    type="password"
                    placeholder="Tu nueva contraseña"
                    error={passwordErrors.new_password?.message}
                    {...registerPassword('new_password')}
                  />
                  <Input
                    label="Confirmar Nueva Contraseña"
                    type="password"
                    placeholder="Confirma tu nueva contraseña"
                    error={passwordErrors.confirm_password?.message}
                    {...registerPassword('confirm_password')}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isChangingPassword}
                  >
                    Cambiar Contraseña
                  </Button>
                </div>
              </form>
            </Card.Body>
          </Card>

          {/* Información de la cuenta */}
          <Card>
            <Card.Header>
              <h2 className="text-xl font-semibold text-gray-900">
                Información de la Cuenta
              </h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">Estado de la cuenta</p>
                    <p className="text-sm text-gray-600">Tu cuenta está activa</p>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Activa
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3">
                  <div>
                    <p className="font-medium text-gray-900">Miembro desde</p>
                    <p className="text-sm text-gray-600">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'No disponible'}
                    </p>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;