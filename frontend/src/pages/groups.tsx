import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '@/components/layout';
import { Button, Card, Input, Modal, useToast } from '@/components/ui';
import { PlusIcon, UsersIcon, CurrencyDollarIcon, PencilIcon } from '@heroicons/react/24/outline';
import { groupsApi } from '@/lib/api';
import { Group, Participant } from '@/types';

const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupParticipants, setGroupParticipants] = useState<{[key: number]: number}>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    payment_amount: '',
    payment_frequency: 'monthly'
  });

  const [editGroup, setEditGroup] = useState({
    name: '',
    description: '',
    payment_amount: '',
    payment_frequency: 'monthly'
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await groupsApi.getGroups();
      setGroups(response.data);
      
      // Load participants count for each group
      const participantCounts: {[key: number]: number} = {};
      for (const group of response.data) {
        try {
          const participantsResponse = await groupsApi.getParticipants(group.id);
          participantCounts[group.id] = participantsResponse.data.length;
        } catch (error) {
          participantCounts[group.id] = 0;
        }
      }
      setGroupParticipants(participantCounts);
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los grupos'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);

    try {
      const groupData = {
        ...newGroup,
        payment_amount: parseFloat(newGroup.payment_amount)
      };
      
      const response = await groupsApi.createGroup(groupData);
      setGroups([...groups, response.data]);
      setShowCreateModal(false);
      setNewGroup({
        name: '',
        description: '',
        payment_amount: '',
        payment_frequency: 'monthly'
      });
      
      addToast({
        type: 'success',
        title: 'Grupo creado',
        message: 'El grupo se ha creado exitosamente'
      });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.detail || 'No se pudo crear el grupo'
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleGroupClick = (groupId: number) => {
    router.push(`/dashboard?groupId=${groupId}`);
  };

  const handleEditGroup = (group: Group) => {
    setSelectedGroup(group);
    setEditGroup({
      name: group.name,
      description: group.description || '',
      payment_amount: group.payment_amount.toString(),
      payment_frequency: group.payment_frequency
    });
    setShowEditModal(true);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    
    setUpdateLoading(true);
    try {
      const groupData = {
        ...editGroup,
        payment_amount: parseFloat(editGroup.payment_amount)
      };
      
      const response = await groupsApi.updateGroup(selectedGroup.id, groupData);
      setGroups(groups.map(g => g.id === selectedGroup.id ? response.data : g));
      setShowEditModal(false);
      setSelectedGroup(null);
      
      addToast({
        type: 'success',
        title: 'Grupo actualizado',
        message: 'El grupo se ha actualizado exitosamente'
      });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.detail || 'No se pudo actualizar el grupo'
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleManageMembers = (groupId: number) => {
    router.push(`/groups/${groupId}/members`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Grupos</h1>
            <p className="text-gray-600">Gestiona tus grupos de pagos</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Crear Grupo
          </Button>
        </div>

        {/* Groups Grid */}
        {groups.length === 0 ? (
          <Card className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes grupos aún
            </h3>
            <p className="text-gray-600 mb-4">
              Crea tu primer grupo para comenzar a gestionar pagos
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              Crear mi primer grupo
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group.id}
                className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
                onClick={() => handleGroupClick(group.id)}
              >
                <Card>
                  <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {group.name}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500">
                      <UsersIcon className="w-4 h-4 mr-1" />
                      {groupParticipants[group.id] || 0}
                    </div>
                  </div>
                  
                  {group.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {group.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center text-primary-600">
                      <CurrencyDollarIcon className="w-5 h-5 mr-1" />
                      <span className="font-semibold">
                        ${group.payment_amount}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 capitalize">
                      {group.payment_frequency}
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditGroup(group);
                      }}
                      className="flex items-center flex-1"
                    >
                      <PencilIcon className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageMembers(group.id);
                      }}
                      className="flex items-center flex-1"
                    >
                      <UsersIcon className="w-4 h-4 mr-1" />
                      Miembros
                    </Button>
                  </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* Create Group Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Crear Nuevo Grupo"
        >
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <Input
              label="Nombre del grupo"
              value={newGroup.name}
              onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              placeholder="Ej: Gastos de oficina"
              required
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                placeholder="Describe el propósito del grupo..."
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            
            <Input
              label="Monto de pago"
              type="number"
              step="0.01"
              min="0"
              value={newGroup.payment_amount}
              onChange={(e) => setNewGroup({ ...newGroup, payment_amount: e.target.value })}
              placeholder="0.00"
              required
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frecuencia de pago
              </label>
              <select
                value={newGroup.payment_frequency}
                onChange={(e) => setNewGroup({ ...newGroup, payment_frequency: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={createLoading}
              >
                Crear Grupo
              </Button>
            </div>
          </form>
        </Modal>

        {/* Edit Group Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Editar Grupo"
        >
          <form onSubmit={handleUpdateGroup} className="space-y-4">
            <Input
              label="Nombre del grupo"
              value={editGroup.name}
              onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })}
              placeholder="Ej: Gastos de oficina"
              required
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                value={editGroup.description}
                onChange={(e) => setEditGroup({ ...editGroup, description: e.target.value })}
                placeholder="Describe el propósito del grupo..."
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            
            <Input
              label="Monto de pago"
              type="number"
              step="0.01"
              min="0"
              value={editGroup.payment_amount}
              onChange={(e) => setEditGroup({ ...editGroup, payment_amount: e.target.value })}
              placeholder="0.00"
              required
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Frecuencia de pago
              </label>
              <select
                value={editGroup.payment_frequency}
                onChange={(e) => setEditGroup({ ...editGroup, payment_frequency: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={updateLoading}
              >
                Actualizar Grupo
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
};

export default GroupsPage;