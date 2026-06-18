// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [socioData, setSocioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rolDeterminado, setRolDeterminado] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setRolDeterminado(false);

      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const adminDoc = await getDoc(doc(db, "admins", firebaseUser.uid));
          if (adminDoc.exists()) {
            setIsAdmin(true);
            setSocioData(null);
          } else {
            setIsAdmin(false);
            const socioQuery = await getDocs(query(
              collection(db, "socios"),
              where("uid", "==", firebaseUser.uid)
            ));
            if (!socioQuery.empty) {
              const socioDoc = socioQuery.docs[0];
              setSocioData({ id: socioDoc.id, ...socioDoc.data() });
            } else {
              setSocioData(null);
            }
          }
        } catch (err) {
          console.error("Error determinando rol:", err);
          setIsAdmin(false);
          setSocioData(null);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setSocioData(null);
      }

      setRolDeterminado(true);
      setLoading(false);
    });

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, socioData, loading, rolDeterminado }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
