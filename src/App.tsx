import { Navigate, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './state/settings';
import { DataProvider } from './state/data';
import { LocalStateProvider } from './state/localState';
import { Shell } from './ui/Shell';
import { BrowsePage } from './features/browse/BrowsePage';
import { RecipePage } from './features/recipe/RecipePage';
import { ShoppingPage } from './features/shopping/ShoppingPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { RecipeFormPage } from './features/edit/RecipeFormPage';

export default function App() {
  return (
    <SettingsProvider>
      <DataProvider>
        <LocalStateProvider>
          <Shell>
            <Routes>
              <Route path="/" element={<BrowsePage />} />
              <Route path="/toevoegen" element={<RecipeFormPage />} />
              <Route path="/recept/:id" element={<RecipePage />} />
              <Route path="/recept/:id/bewerken" element={<RecipeFormPage />} />
              <Route path="/lijst" element={<ShoppingPage />} />
              <Route path="/instellingen" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </LocalStateProvider>
      </DataProvider>
    </SettingsProvider>
  );
}
