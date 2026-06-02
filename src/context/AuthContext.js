// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";

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
          // Buscar socio por campo uid
          const sociosSnap = await getDocs(query(
            collection(db, "socios"),
            where("uid", "==", firebaseUser.uid)
          ));
          if (!sociosSnap.empty) {
            const socioDoc = sociosSnap.docs[0];
            setSocioData({ id: socioDoc.id, ...socioDoc.data() });
          } else {
            // Fallback: buscar por ID del documento
            const socioDoc = await getDoc(doc(db, "socios", firebaseUser.uid));
            if (socioDoc.exists()) {
              setSocioData({ id: socioDoc.id, ...socioDoc.data() });
            } else {
              setSocioData(null);
            }
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
