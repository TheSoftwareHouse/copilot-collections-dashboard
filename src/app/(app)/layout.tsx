import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { getSession } from "@/lib/auth";
import NavBar from "@/components/NavBar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dataSource = await getDb();
  const repository = dataSource.getRepository(ConfigurationEntity);
  const config = await repository.findOne({ where: {} });

  if (!config) {
    redirect("/setup");
  }

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <Suspense>
        <NavBar />
      </Suspense>
      {children}
    </>
  );
}
