import Image from "next/image";

export default function AuthHeader() {
  return (
    <section className="relative -mt-5 overflow-hidden bg-green rounded-b-[50%]">

      <div className="auth-header-content flex flex-col items-center pt-14 pb-12">

        <h1 className="text-5xl font-bold text-bone">
          KOBI
        </h1>

        <p className="mt-2 text-sm font-semibold text-bone">
          Asisten Gizi Mahasiswa
        </p>

        <Image
          src="/assets/mascot.webp"
          alt="KOBI Mascot"
          width={210}
          height={210}
          className="auth-header-mascot mt-8"
        />

      </div>

    </section>
  );
}