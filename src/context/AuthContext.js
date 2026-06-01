// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [socioData, setSocioData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Verificar si es admin
        const adminDoc = await getDoc(doc(db, "admins", firebaseUser.uid));
        if (adminDoc.exists()) {
          setIsAdmin(true);
          setSocioData(null);
        } else {
          setIsAdmin(false);
          // Cargar datos del socio
          const socioDoc = await getDoc(doc(db, "socios", firebaseUser.uid));
          if (socioDoc.exists()) {
            setSocioData({ id: socioDoc.id, ...socioDoc.data() });
          }
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setSocioData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, socioData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
