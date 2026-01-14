"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreVertical, Edit2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTanks } from "@/hooks/use-tanks";

interface NodeActionsProps {
    id: string;
    name: string;
    location: string;
    capacity: number;
    height: number;
}

export function NodeActions({ id, name, location, capacity, height }: NodeActionsProps) {
    const { updateTank, deleteTank, isDeleting, isUpdating } = useTanks();
    const [activeDialog, setActiveDialog] = useState<"edit" | "delete" | null>(null);
    const [editForm, setEditForm] = useState({ name, location, capacity, height });

    // Sync form when dialog opens
    useEffect(() => {
        if (activeDialog === "edit") {
            setEditForm({ name, location, capacity, height });
        }
    }, [activeDialog, name, location, capacity, height]);

    const handleUpdate = () => {
        updateTank({
            id,
            ...editForm,
            capacity: Number(editForm.capacity),
            height: Number(editForm.height)
        });
        setActiveDialog(null);
        toast.success("Configuration updated and synced to node");
    };

    const handleDelete = async () => {
        try {
            await deleteTank(id);
            setActiveDialog(null);
            toast.success("System decommissioned from fleet");
        } catch (error) {
            console.error(error);
            toast.error("Failed to remove system");
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                        onClick={() => {
                            setActiveDialog("edit");
                        }}
                        className="gap-2 focus:bg-primary/5 cursor-pointer"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Update Node</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => {
                            setActiveDialog("delete");
                        }}
                        className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove System</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Edit Dialog */}
            <Dialog open={activeDialog === "edit"} onOpenChange={(open) => !open && setActiveDialog(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Node Configuration</DialogTitle>
                        <DialogDescription>
                            Update sensor node details. Changes persist to the secure infrastructure.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input
                                id="name"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="location" className="text-right">Location</Label>
                            <Input
                                id="location"
                                value={editForm.location}
                                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="capacity" className="text-right">Capacity (L)</Label>
                            <Input
                                id="capacity"
                                type="number"
                                value={editForm.capacity}
                                onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="height" className="text-right">Height (cm)</Label>
                            <Input
                                id="height"
                                type="number"
                                value={editForm.height}
                                onChange={(e) => setEditForm({ ...editForm, height: Number(e.target.value) })}
                                className="col-span-3"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setActiveDialog(null)} disabled={isUpdating}>Cancel</Button>
                        <Button onClick={handleUpdate} disabled={isUpdating} className="min-w-[100px]">
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={activeDialog === "delete"} onOpenChange={(open) => !open && setActiveDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete
                            <span className="font-semibold text-foreground"> {name} </span>
                            node from your monitoring fleet.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-w-[140px]"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove System"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
