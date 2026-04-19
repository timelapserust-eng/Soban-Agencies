import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Settings() {
  const profile = useLiveQuery(() => db.profile.get(1));
  
  const [form, setForm] = useState({ 
    name: 'SOBAN AGENCIES', 
    tagline: 'Distributors & Wholesalers', 
    address: 'Main Bazaar, City Center', 
    phone: '(+92) 300 1234567',
    ownerContact: '',
    email: ''
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        tagline: profile.tagline,
        address: profile.address,
        phone: profile.phone,
        ownerContact: profile.ownerContact || '',
        email: profile.email || ''
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (profile) {
        await db.profile.update(1, form);
      } else {
        await db.profile.put({ id: 1, ...form });
      }
      toast.success("Settings saved successfully!");
    } catch (err) {
      toast.error("Failed to save settings");
      console.error(err);
    }
  };

  return (
    <div className="max-w-2xl">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>System & Company Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Agency / Business Name</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Tagline (e.g. Distributors & Wholesalers)</Label>
              <Input 
                value={form.tagline} 
                onChange={(e) => setForm({...form, tagline: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Business Address</Label>
              <Input 
                value={form.address} 
                onChange={(e) => setForm({...form, address: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Phone</Label>
                <Input 
                  value={form.phone} 
                  onChange={(e) => setForm({...form, phone: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label>Owner Contact Number</Label>
                <Input 
                  value={form.ownerContact} 
                  onChange={(e) => setForm({...form, ownerContact: e.target.value})} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={form.email} 
                onChange={(e) => setForm({...form, email: e.target.value})} 
              />
            </div>

            <Button type="submit" className="mt-4">Save Settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
