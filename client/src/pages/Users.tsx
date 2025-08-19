import { AdvancedDataTable, Column } from "@/components/AdvancedDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Database, Users as UsersIcon, Edit, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// User interface
interface User {
  _id: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Role: string;
  createdAt?: string;
  updatedAt?: string;
}

// Form data interface
interface UserFormData {
  FirstName: string;
  LastName: string;
  Email: string;
  Role: string;
  Password: string;
}

const ROLES = [
  { value: 'Admin', label: 'Administrator' },
  { value: 'Manager', label: 'Manager' },
  { value: 'User', label: 'User' },
  { value: 'Viewer', label: 'Viewer' }
];

export default function Users() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const { toast } = useToast();

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState<UserFormData>({
    FirstName: '',
    LastName: '',
    Email: '',
    Role: '',
    Password: ''
  });

  // Fetch data from MongoDB API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    console.log('[USERS-PAGE] Fetching real-time data...');
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        search: searchTerm,
        sortBy: 'FirstName',
        sortOrder: 'ASC',
        _t: Date.now().toString() // Cache busting
      });

      const response = await fetch(`/api/users?${params}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setData(result.data);
        setTotalRecords(result.total || 0);
      } else {
        setData([]);
        setTotalRecords(0);
        if (result.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setData([]);
      setTotalRecords(0);
      setError(err instanceof Error ? err.message : 'Failed to load data from MongoDB');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm]);

  // Reset form data
  const resetForm = () => {
    setFormData({
      FirstName: '',
      LastName: '',
      Email: '',
      Role: '',
      Password: ''
    });
    setShowPassword(false);
  };

  // Handle add user
  const handleAddUser = async () => {
    if (!formData.FirstName || !formData.LastName || !formData.Email || !formData.Role || !formData.Password) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive"
      });
      return;
    }

    setFormLoading(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "User Created",
          description: `${formData.FirstName} ${formData.LastName} has been added successfully`
        });
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        toast({
          title: "Error Creating User",
          description: result.error || "Failed to create user",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: "Failed to create user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    if (!selectedUser || !formData.FirstName || !formData.LastName || !formData.Email || !formData.Role) {
      toast({
        title: "Validation Error",
        description: "First Name, Last Name, Email, and Role are required",
        variant: "destructive"
      });
      return;
    }

    setFormLoading(true);
    try {
      const updateData = {
        FirstName: formData.FirstName,
        LastName: formData.LastName,
        Email: formData.Email,
        Role: formData.Role,
        ...(formData.Password && { Password: formData.Password })
      };

      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "User Updated",
          description: `${formData.FirstName} ${formData.LastName} has been updated successfully`
        });
        setShowEditModal(false);
        setSelectedUser(null);
        resetForm();
        fetchData();
      } else {
        toast({
          title: "Error Updating User",
          description: result.error || "Failed to update user",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "Failed to update user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setFormLoading(true);
    try {
      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "User Deleted",
          description: `${selectedUser.FirstName} ${selectedUser.LastName} has been deleted successfully`
        });
        setShowDeleteDialog(false);
        setSelectedUser(null);
        fetchData();
      } else {
        toast({
          title: "Error Deleting User",
          description: result.error || "Failed to delete user",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      FirstName: user.FirstName,
      LastName: user.LastName,
      Email: user.Email,
      Role: user.Role,
      Password: '' // Don't pre-fill password
    });
    setShowEditModal(true);
  };

  // Open delete dialog
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for global search and add events from Layout
  useEffect(() => {
    const handleSearch = (event: CustomEvent) => {
      setSearchTerm(event.detail);
      setCurrentPage(1);
    };

    const handleAdd = () => {
      console.log('Add user button clicked');
      setShowAddModal(true);
    };

    const handleExport = async () => {
      console.log("Export event received - Exporting ALL users data...");
      
      try {
        const exportParams = new URLSearchParams({
          page: '1',
          pageSize: '10000',
          search: searchTerm,
          sortBy: 'FirstName',
          sortOrder: 'ASC'
        });

        const response = await fetch(`/api/users?${exportParams}`);
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
          const headers = ['First Name', 'Last Name', 'Email', 'Role', 'Created At'];
          
          const rows = result.data.map((user: User) => {
            return [
              user.FirstName,
              user.LastName,
              user.Email,
              user.Role,
              user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''
            ].map(value => {
              if (value && (value.toString().includes(',') || value.toString().includes('"'))) {
                return `"${value.toString().replace(/"/g, '""')}"`;
              }
              return value || '';
            }).join(',');
          });
          
          const csv = [headers.join(','), ...rows].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
          
          toast({
            title: "Export Successful",
            description: `Exported ${result.data.length} user records to CSV`,
          });
        } else {
          toast({
            title: "No Data to Export",
            description: "There are no user records to export",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error exporting users data:', error);
        toast({
          title: "Export Failed",
          description: "Failed to export users data. Please try again.",
          variant: "destructive"
        });
      }
    };

    window.addEventListener('global-search', handleSearch as EventListener);
    window.addEventListener('add-user', handleAdd);
    window.addEventListener('export-data', handleExport);

    return () => {
      window.removeEventListener('global-search', handleSearch as EventListener);
      window.removeEventListener('add-user', handleAdd);
      window.removeEventListener('export-data', handleExport);
    };
  }, [searchTerm, toast]);

  const columns: Column<User>[] = [
    {
      key: "FirstName",
      header: "First Name",
      width: "150px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "LastName",
      header: "Last Name",
      width: "150px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <span className="text-sm font-medium">{value}</span>
      ),
    },
    {
      key: "Email",
      header: "Email Address",
      width: "250px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <span className="text-sm text-muted-foreground">{value}</span>
      ),
    },
    {
      key: "Role",
      header: "Role",
      width: "120px",
      sortable: true,
      searchable: true,
      render: (value) => {
        const roleColors = {
          'Admin': 'bg-red-100 text-red-800 border-red-200',
          'Manager': 'bg-blue-100 text-blue-800 border-blue-200',
          'User': 'bg-green-100 text-green-800 border-green-200',
          'Viewer': 'bg-gray-100 text-gray-800 border-gray-200'
        };
        return (
          <Badge 
            variant="outline" 
            className={`text-xs px-2 py-1 ${roleColors[value as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}`}
          >
            {value}
          </Badge>
        );
      },
    },
    {
      key: "Password",
      header: "Password",
      width: "100px",
      sortable: false,
      searchable: false,
      render: () => (
        <span className="text-xs text-muted-foreground">••••••••</span>
      ),
    },
    {
      key: "_id",
      header: "Actions",
      width: "120px",
      sortable: false,
      searchable: false,
      render: (value, row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
            className="h-8 w-8 p-0 hover:bg-blue-100"
            title="Edit User"
          >
            <Edit className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDeleteDialog(row)}
            className="h-8 w-8 p-0 hover:bg-red-100"
            title="Delete User"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  // Loading state
  if (loading && data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading users from MongoDB...</p>
        </div>
      </div>
    );
  }

  // Empty state when no data exists
  if (!loading && data.length === 0) {
    return (
      <>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Users</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error ? error : "No user records found in the database."}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => fetchData()}
                className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Refresh
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                Add First User
              </button>
            </div>
          </div>
        </div>

        {/* Add User Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with the required information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="firstName" className="text-right">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  value={formData.FirstName}
                  onChange={(e) => setFormData({ ...formData, FirstName: e.target.value })}
                  className="col-span-3"
                  placeholder="Enter first name"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="lastName" className="text-right">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  value={formData.LastName}
                  onChange={(e) => setFormData({ ...formData, LastName: e.target.value })}
                  className="col-span-3"
                  placeholder="Enter last name"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.Email}
                  onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
                  className="col-span-3"
                  placeholder="Enter email address"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Select value={formData.Role} onValueChange={(value) => setFormData({ ...formData, Role: value })}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                  Password
                </Label>
                <div className="col-span-3 relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.Password}
                    onChange={(e) => setFormData({ ...formData, Password: e.target.value })}
                    placeholder="Enter password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={formLoading}>
                {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Data table view
  return (
    <>
      <div className="h-full p-2">
        <AdvancedDataTable
          data={data}
          columns={columns}
          pageSize={pageSize}
          stickyHeader={true}
          rowHeight="compact"
          tableHeight="calc(100vh - 60px)"
          serverSide={true}
          totalRecords={totalRecords}
          currentPage={currentPage}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          }}
        />
        {loading && (
          <div className="absolute top-2 right-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with the required information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">
                First Name
              </Label>
              <Input
                id="firstName"
                value={formData.FirstName}
                onChange={(e) => setFormData({ ...formData, FirstName: e.target.value })}
                className="col-span-3"
                placeholder="Enter first name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">
                Last Name
              </Label>
              <Input
                id="lastName"
                value={formData.LastName}
                onChange={(e) => setFormData({ ...formData, LastName: e.target.value })}
                className="col-span-3"
                placeholder="Enter last name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.Email}
                onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
                className="col-span-3"
                placeholder="Enter email address"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select value={formData.Role} onValueChange={(value) => setFormData({ ...formData, Role: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.Password}
                  onChange={(e) => setFormData({ ...formData, Password: e.target.value })}
                  placeholder="Enter password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={formLoading}>
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep current password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editFirstName" className="text-right">
                First Name
              </Label>
              <Input
                id="editFirstName"
                value={formData.FirstName}
                onChange={(e) => setFormData({ ...formData, FirstName: e.target.value })}
                className="col-span-3"
                placeholder="Enter first name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editLastName" className="text-right">
                Last Name
              </Label>
              <Input
                id="editLastName"
                value={formData.LastName}
                onChange={(e) => setFormData({ ...formData, LastName: e.target.value })}
                className="col-span-3"
                placeholder="Enter last name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editEmail" className="text-right">
                Email
              </Label>
              <Input
                id="editEmail"
                type="email"
                value={formData.Email}
                onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
                className="col-span-3"
                placeholder="Enter email address"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editRole" className="text-right">
                Role
              </Label>
              <Select value={formData.Role} onValueChange={(value) => setFormData({ ...formData, Role: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editPassword" className="text-right">
                Password
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="editPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.Password}
                  onChange={(e) => setFormData({ ...formData, Password: e.target.value })}
                  placeholder="Leave blank to keep current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedUser(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={formLoading}>
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for{' '}
              <strong>{selectedUser?.FirstName} {selectedUser?.LastName}</strong> and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSelectedUser(null); }} disabled={formLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={formLoading}>
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}