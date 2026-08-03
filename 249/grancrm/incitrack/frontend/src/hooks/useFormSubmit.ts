import { useState } from 'react';

export function useFormSubmit(
  action: () => Promise<void>,
  onSuccess?: () => void
) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await action();
      onSuccess?.();
    } catch (err) {
      setSaveError(String((err as Error).message ?? err));
    } finally {
      setSaving(false);
    }
  };

  return { saving, saveError, handleSubmit, setSaveError };
}
