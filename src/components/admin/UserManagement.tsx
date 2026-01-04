import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Users, Search, RefreshCw, Shield, Edit2, Mail, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ROLE_METADATA, SOCRole } from '@/hooks/usePermissions';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserWithRole extends UserProfile {
  role: SOCRole;
  role_created_at: string;
}

interface UserManagementProps {
  safeMode: boolean;
}

const ALL_ROLES: SOCRole[] = ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'grc_engineer', 'ciso'];

export function UserManagement({ safeMode }: UserManagementProps) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile: UserProfile) => {
        const userRole = roles?.find((r: { user_id: string; role: string }) => r.user_id === profile.id);
        return {
          ...profile,
          role: (userRole?.role as SOCRole) || 'soc_tier_1',
          role_created_at: userRole?.created_at || profile.created_at,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async () => {
    if (!editingUser || !newRole) return;
    
    if (safeMode) {
      toast.error('Cannot modify roles in Safe Mode');
      return;
    }

    try {
      const { error } = await supabase.rpc('set_user_role', {
        _target_user: editingUser.id,
        _new_role: newRole as SOCRole,
      });

      if (error) throw error;

      toast.success(`Updated ${editingUser.email} to ${ROLE_METADATA[newRole as SOCRole]?.label || newRole}`);
      setIsDialogOpen(false);
      setEditingUser(null);
      setNewRole('');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update user role');
    }
  };

  const getRoleBadge = (role: SOCRole) => {
    const meta = ROLE_METADATA[role];
    if (!meta) {
      return <Badge variant="secondary">{role}</Badge>;
    }
    return (
      <Badge variant="outline" className={`flex items-center gap-1 ${meta.badgeClass}`}>
        <Shield className="h-3 w-3" />
        {meta.label}
      </Badge>
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Count users by role
  const roleCounts = ALL_ROLES.reduce((acc, role) => {
    acc[role] = users.filter(u => u.role === role).length;
    return acc;
  }, {} as Record<SOCRole, number>);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {ALL_ROLES.map(role => (
          <Card key={role} className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{ROLE_METADATA[role].label}</p>
                <p className="text-2xl font-bold">{roleCounts[role]}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ALL_ROLES.map(role => (
                  <SelectItem key={role} value={role}>{ROLE_METADATA[role].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage user accounts and SOC role assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.full_name || 'No name'}</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ROLE_METADATA[user.role]?.description || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Dialog open={isDialogOpen && editingUser?.id === user.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (!open) {
                            setEditingUser(null);
                            setNewRole('');
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingUser(user);
                                setNewRole(user.role);
                                setIsDialogOpen(true);
                              }}
                              disabled={user.id === currentUser?.id}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit User Role</DialogTitle>
                              <DialogDescription>
                                Change role for {user.email}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Current Role</Label>
                                <div>{getRoleBadge(user.role)}</div>
                                <p className="text-xs text-muted-foreground">{ROLE_METADATA[user.role]?.description}</p>
                              </div>
                              <div className="space-y-2">
                                <Label>New Role</Label>
                                <Select value={newRole} onValueChange={setNewRole}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_ROLES.map(role => (
                                      <SelectItem key={role} value={role}>
                                        <div className="flex flex-col">
                                          <span>{ROLE_METADATA[role].label}</span>
                                          <span className="text-xs text-muted-foreground">{ROLE_METADATA[role].description}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {safeMode && (
                                <p className="text-sm text-destructive">
                                  Safe Mode is ON - role changes are disabled
                                </p>
                              )}
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button 
                                onClick={updateUserRole} 
                                disabled={safeMode || newRole === user.role}
                              >
                                Update Role
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
