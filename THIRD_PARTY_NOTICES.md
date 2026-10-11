# Third-Party Software Notices and Licenses

The **Ngopi** application (https://ngopi.top) incorporates and depends upon third-party open-source software libraries, frameworks, and fonts.
Yayasan Sabumi Nusantara Jaya acknowledges the contributions of the open-source community.
All third-party copyrights, trademarks, and license rights belong to their respective copyright holders.

---

## I. Inventory of Direct Dependencies & Verification Status

### 1. Frontend Dependencies (`frontend/package.json`)

| Package | Version | License | Copyright Notice / Attributed Author | Status Verifikasi |
| :--- | :--- | :--- | :--- | :--- |
| `expo` | `~57.0.2` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `@expo/metro-runtime` | `~57.0.3` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `@expo/vector-icons` | `^15.1.1` | MIT | Copyright (c) 2015 Joel Arvidsson | Terverifikasi dari berkas paket (lihat Bagian IV untuk font biner) |
| `expo-av` | `^16.0.8` | MIT | 650 Industries, Inc. (Expo monorepo) | Verifikasi: Mengikuti lisensi monorepo Expo; tidak ada berkas notice terpisah di subfolder |
| `expo-constants` | `~57.0.3` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `expo-document-picker` | `~57.0.0` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `expo-image-picker` | `~57.0.2` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `expo-linking` | `~57.0.1` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `expo-router` | `~57.0.3` | MIT | 650 Industries, Inc. (Expo monorepo) | Verifikasi: Mengikuti lisensi monorepo Expo; tidak ada berkas notice terpisah di subfolder |
| `expo-secure-store` | `^57.0.0` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `expo-splash-screen` | `~57.0.9` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `expo-status-bar` | `~57.0.0` | MIT | Copyright (c) 2015-present 650 Industries, Inc. (aka Expo) | Terverifikasi dari berkas paket |
| `react` | `19.2.3` | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | Terverifikasi dari berkas paket |
| `react-dom` | `19.2.3` | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | Terverifikasi dari berkas paket |
| `react-native` | `0.86.0` | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | Terverifikasi dari berkas paket |
| `react-native-web` | `^0.21.2` | MIT | Copyright (c) Nicolas Gallagher. | Terverifikasi dari berkas paket |
| `react-native-screens` | `4.25.2` | MIT | Copyright (c) 2018 Software Mansion <swmansion.com> | Terverifikasi dari berkas paket |
| `react-native-safe-area-context` | `~5.7.0` | MIT | Copyright (c) 2019 Th3rd Wave | Terverifikasi dari berkas paket |
| `axios` | `^1.18.1` | MIT | Copyright (c) 2014-present Matt Zabriskie & Collaborators | Terverifikasi dari berkas paket |
| `crypto-js` | `^4.2.0` | MIT | Copyright (c) 2009-2013 Jeff Mott | Terverifikasi dari berkas paket |
| `socket.io-client` | `^4.8.3` | MIT | Copyright (c) 2014-present Guillermo Rauch and Socket.IO contributors | Terverifikasi dari berkas paket |
| `tweetnacl` | `^1.0.3` | Unlicense | Dmitry Chestnykh (Public Domain) | Terverifikasi dari berkas paket |
| `tweetnacl-util` | `^0.15.1` | Unlicense | Dmitry Chestnykh (Public Domain) | Terverifikasi dari berkas paket |

---

### 2. Backend Dependencies (`backend/package.json`)

| Package | Version | License | Copyright Notice / Attributed Author | Status Verifikasi |
| :--- | :--- | :--- | :--- | :--- |
| `express` | `^5.2.1` | MIT | TJ Holowaychuk, Roman Shtylman, Douglas Christopher Wilson, dkk. | Terverifikasi dari metadata npm & lisensi Express |
| `socket.io` | `^4.8.3` | MIT | Automattic / Guillermo Rauch & kontributor Socket.IO | Terverifikasi dari metadata npm & lisensi Socket.IO |
| `ws` | `^8.21.0` | MIT | Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com> | Terverifikasi dari metadata npm |
| `@prisma/client` | `^7.8.0` | Apache-2.0 | Prisma Data, Inc. | Terverifikasi dari metadata Prisma |
| `@prisma/adapter-pg` | `^7.8.0` | Apache-2.0 | Prisma Data, Inc. (Author: Tom Houlé) | Terverifikasi dari metadata Prisma |
| `@prisma/adapter-neon` | `^7.8.0` | Apache-2.0 | Prisma Data, Inc. (Author: Alberto Schiabel) | Terverifikasi dari metadata Prisma |
| `pg` | `^8.22.0` | MIT | Copyright (c) 2010-2024 Brian Carlson | Terverifikasi dari metadata npm |
| `@neondatabase/serverless` | `^1.1.0` | MIT | Neon, Inc. | Terverifikasi dari metadata npm |
| `jsonwebtoken` | `^9.0.3` | MIT | Auth0, Inc. | Terverifikasi dari metadata npm |
| `bcryptjs` | `^3.0.3` | BSD-3-Clause | Daniel Wirtz | Terverifikasi dari metadata npm |
| `joi` | `^18.2.3` | BSD-3-Clause | Sideway Inc. | Terverifikasi dari metadata npm |
| `dotenv` | `^17.4.2` | BSD-2-Clause | Scott Motte (Motdotla) | Terverifikasi dari metadata npm |
| `helmet` | `^8.2.0` | MIT | Adam Baldwin | Terverifikasi dari metadata npm |
| `cors` | `^2.8.6` | MIT | Troy Goode | Terverifikasi dari metadata npm |
| `cookie-parser` | `^1.4.7` | MIT | TJ Holowaychuk | Terverifikasi dari metadata npm |
| `express-rate-limit` | `^8.5.2` | MIT | Nathan Friedly | Terverifikasi dari metadata npm |
| `multer` | `^2.2.0` | MIT | Hage Yaapa | Terverifikasi dari metadata npm |
| `node-ssh` | `^13.2.1` | MIT | Steel Brain | Terverifikasi dari metadata npm |
| `otplib` | `^13.4.1` | MIT | Gerald Yeo | Terverifikasi dari metadata npm |
| `qrcode` | `^1.5.4` | MIT | Ryan Day | Terverifikasi dari metadata npm |
| `ethers` | `^6.17.0` | MIT | Richard Moore | Terverifikasi dari metadata npm |
| `sharp` | `^0.35.3` | Apache-2.0 | Lovell Fuller & kontributor sharp | Terverifikasi dari metadata npm (lihat catatan libvips) |
| `@types/qrcode`, `@types/sharp` | Berbagai | MIT | DefinitelyTyped contributors | Terverifikasi dari metadata DefinitelyTyped |

*Catatan Khusus Sharp / Libvips:* Pustaka `sharp` menggunakan modul native `libvips` yang dilisensikan di bawah `LGPL-3.0-or-later`. Pustaka ini hanya dieksekusi secara privat di lingkungan server (VPS backend) untuk pemrosesan gambar avatar pengguna. Biner pustaka tidak pernah didistribusikan kepada perangkat klien pengguna, sehingga tidak memicu kewajiban pembukaan kode sumber di bawah klausul LGPL v3.

---

## II. Teks Lengkap Lisensi Pihak Ketiga

### 1. The MIT License
Digunakan oleh: `expo`, `react`, `react-native`, `react-native-web`, `react-native-screens`, `react-native-safe-area-context`, `axios`, `crypto-js`, `socket.io`, `socket.io-client`, `express`, `pg`, `ws`, `helmet`, `cors`, `cookie-parser`, `express-rate-limit`, `multer`, `node-ssh`, `otplib`, `qrcode`, `ethers`, `@neondatabase/serverless`, dan modul terkait.

```text
The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 2. Apache License, Version 2.0
Digunakan oleh: `@prisma/client`, `@prisma/adapter-pg`, `@prisma/adapter-neon`, `sharp`, `MaterialIcons`.

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.
   "License" shall mean the terms and conditions for use, reproduction,
   and distribution as defined by Sections 1 through 9 of this document.
   "Licensor" shall mean the copyright owner or entity authorized by
   the copyright owner that is granting the License.
   "Legal Entity" shall mean the union of the acting entity and all
   other entities that control, are controlled by, or are under common
   control with that entity.
   "You" (or "Your") shall mean an individual or Legal Entity
   exercising permissions granted by this License.
   "Source" form shall mean the preferred form for making modifications,
   including but not limited to software source code, documentation
   source, and configuration files.
   "Object" form shall mean any form resulting from mechanical
   transformation or translation of a Source form, including but
   not limited to compiled object code, generated documentation,
   and conversions to other media types.
   "Work" shall mean the work of authorship, whether in Source or
   Object form, made available under the License.
   "Derivative Works" shall mean any work, whether in Source or Object
   form, that is based on (or derived from) the Work and for which the
   editorial revisions, annotations, elaborations, or other modifications
   represent, as a whole, an original work of authorship.

2. Grant of Copyright License. Subject to the terms and conditions of
   this License, each Contributor hereby grants to You a perpetual,
   worldwide, non-exclusive, no-charge, royalty-free, irrevocable
   copyright license to reproduce, prepare Derivative Works of,
   publicly display, publicly perform, sublicense, and distribute the
   Work and such Derivative Works in Source or Object form.

3. Grant of Patent License. Subject to the terms and conditions of
   this License, each Contributor hereby grants to You a perpetual,
   worldwide, non-exclusive, no-charge, royalty-free, irrevocable
   (except as stated in this section) patent license to make, have made,
   use, offer to sell, sell, import, and otherwise transfer the Work.

4. Redistribution. You may reproduce and distribute copies of the
   Work or Derivative Works thereof in any medium, with or without
   modifications, and in Source or Object form, provided that You
   meet the following conditions:
   (a) You must give any other recipients of the Work or
       Derivative Works a copy of this License; and
   (b) You must cause any modified files to carry prominent notices
       stating that You changed the files; and
   (c) You must retain, in the Source form of any Derivative Works
       that You distribute, all copyright, patent, trademark, and
       attribution notices from the Source form of the Work; and
   (d) If the Work includes a "NOTICE" text file as part of its
       distribution, then any Derivative Works that You distribute must
       include a readable copy of the attribution notices contained
       within such NOTICE file.

5. Submission of Contributions. Unless You explicitly state otherwise,
   any Contribution intentionally submitted for inclusion in the Work
   by You to the Licensor shall be under the terms and conditions of
   this License, without any additional terms or conditions.

6. Trademarks. This License does not grant permission to use the trade
   names, trademarks, service marks, or product names of the Licensor,
   except as required for reasonable and customary use in describing the
   origin of the Work and reproducing the content of the NOTICE file.

7. Disclaimer of Warranty. Unless required by applicable law or
   agreed to in writing, Licensor provides the Work on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

8. Limitation of Liability. In no event and under no legal theory,
   whether in tort (including negligence), contract, or otherwise,
   shall any Contributor be liable to You for damages, including any
   direct, indirect, special, incidental, or consequential damages.

9. Accepting Warranty or Additional Liability. While redistributing
   the Work or Derivative Works thereof, You may choose to offer,
   and charge a fee for, acceptance of support, warranty, indemnity,
   or other liability obligations and/or rights consistent with this
   License.
```

---

### 3. BSD 3-Clause License
Digunakan oleh: `bcryptjs`, `joi`.

```text
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

### 4. BSD 2-Clause License
Digunakan oleh: `dotenv`.

```text
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

### 5. The Unlicense (Public Domain)
Digunakan oleh: `tweetnacl`, `tweetnacl-util`.

```text
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>
```

---

## III. Upstream Template Scaffold Notice

Berkas `frontend/LICENSE` yang berada di dalam folder frontend dipertahankan sesuai aslinya untuk memenuhi kewajiban atribusi terhadap template scaffold awal yang di-generate dari `create-expo-app`:

```text
The MIT License (MIT)
Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)
```
*(Catatan: Pemberitahuan hak cipta 650 Industries, Inc. di atas hanya berlaku untuk file pondasi scaffold Expo asli yang digunakan saat inisialisasi repositori, dan tidak mencakup maupun mengalihkan hak cipta atas kode orisinal aplikasi Ngopi).*

---

## IV. Font & Asset Embedding Notices

Bundel web Ngopi memuat pustaka `@expo/vector-icons` yang menyertakan berkas font biner:
* **Ionicons:** Dilisensikan di bawah lisensi MIT oleh Ionic / Drifty Co.
* **Material Icons:** Dilisensikan di bawah Apache License 2.0 oleh Google LLC.
* **FontAwesome:** Font biner dilisensikan di bawah SIL Open Font License 1.1; kode terkait dilisensikan di bawah MIT License. Font ini disematkan secara bebas tanpa dijual terpisah sesuai ketentuan SIL OFL 1.1.
