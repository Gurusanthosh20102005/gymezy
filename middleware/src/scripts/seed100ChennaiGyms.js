import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import Gym from '../models/gym.model.js';
import { Employee } from '../models/employee.model.js';
import User from '../models/user.model.js';
import Counter from '../models/counter.model.js';
import { buildStandardCustomPricingPlans } from '../controllers/gym.controller.js';

// High quality fitness photography from Unsplash
const GYM_IMAGES_POOL = [
  'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1570829460005-c840387bb1ca?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1576678927484-cc907957088c?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1554284126-aa88f22d8b74?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1518310383802-640c2de311b2?q=80&w=800&auto=format&fit=crop',
];

const TRAINER_AVATARS = [
  'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=400&auto=format&fit=crop',
];

// 100 Real Chennai Localities with exact Pincode and GPS coordinates [lng, lat]
const CHENNAI_100_AREAS = [
  // 1-10: Central Core
  { area: 'Anna Nagar', pincode: '600040', lng: 80.2101, lat: 13.0850, street: '2nd Avenue, Block AB' },
  { area: 'T. Nagar', pincode: '600017', lng: 80.2337, lat: 13.0418, street: 'Usman Road, Near Panagal Park' },
  { area: 'Nungambakkam', pincode: '600034', lng: 80.2425, lat: 13.0569, street: 'Khadar Nawaz Khan Road' },
  { area: 'Alwarpet', pincode: '600018', lng: 80.2496, lat: 13.0336, street: 'TTK Road, Near Park Sheraton' },
  { area: 'Mylapore', pincode: '600004', lng: 80.2676, lat: 13.0368, street: 'Luz Church Road' },
  { area: 'Kilpauk', pincode: '600010', lng: 80.2413, lat: 13.0784, street: 'Poonamallee High Road' },
  { area: 'Chetpet', pincode: '600031', lng: 80.2435, lat: 13.0712, street: 'Harrington Road' },
  { area: 'Shenoy Nagar', pincode: '600030', lng: 80.2272, lat: 13.0799, street: 'West Club Road' },
  { area: 'Egmore', pincode: '600008', lng: 80.2609, lat: 13.0732, street: 'Montieth Road' },
  { area: 'Royapettah', pincode: '600014', lng: 80.2604, lat: 13.0526, street: 'Whites Road, Express Avenue Vicinity' },

  // 11-20: South Urban
  { area: 'Adyar', pincode: '600020', lng: 80.2574, lat: 13.0067, street: 'Sardar Patel Road' },
  { area: 'Besant Nagar', pincode: '600090', lng: 80.2676, lat: 13.0002, street: '4th Main Road, Near Elliot Beach' },
  { area: 'Thiruvanmiyur', pincode: '600041', lng: 80.2575, lat: 12.9830, street: 'Lattice Bridge Road' },
  { area: 'R.A. Puram', pincode: '600028', lng: 80.2581, lat: 13.0232, street: 'Greenways Road' },
  { area: 'Mandaveli', pincode: '600028', lng: 80.2608, lat: 13.0284, street: 'St. Marys Road' },
  { area: 'Kotturpuram', pincode: '600085', lng: 80.2415, lat: 13.0189, street: 'Gandhi Mandapam Road' },
  { area: 'Saidapet', pincode: '600015', lng: 80.2227, lat: 13.0213, street: 'Anna Salai, Maraimalai Adigal Bridge' },
  { area: 'Guindy', pincode: '600032', lng: 80.2184, lat: 13.0067, street: 'Race Course Road' },
  { area: 'Nandanam', pincode: '600035', lng: 80.2392, lat: 13.0264, street: 'Chamiers Road' },
  { area: 'Teynampet', pincode: '600018', lng: 80.2483, lat: 13.0401, street: 'Mount Road, SIET College Road' },

  // 21-30: South Residential & Lakes
  { area: 'Velachery', pincode: '600042', lng: 80.2184, lat: 12.9815, street: '100 Feet Bypass Road' },
  { area: 'Madipakkam', pincode: '600091', lng: 80.1966, lat: 12.9623, street: 'Medavakkam Main Road' },
  { area: 'Keelkattalai', pincode: '600117', lng: 80.1834, lat: 12.9571, street: '200 Feet Radial Road' },
  { area: 'Pallikaranai', pincode: '600100', lng: 80.2144, lat: 12.9349, street: 'Velachery-Tambaram Main Road' },
  { area: 'Medavakkam', pincode: '600100', lng: 80.1916, lat: 12.9198, street: 'Perumbakkam Road' },
  { area: 'Kovilambakkam', pincode: '600129', lng: 80.1878, lat: 12.9389, street: 'Sunnambu Kolathur Main Road' },
  { area: 'Nanmangalam', pincode: '600129', lng: 80.1789, lat: 12.9345, street: 'Nemilichery High Road' },
  { area: 'Sembakkam', pincode: '600073', lng: 80.1589, lat: 12.9234, street: 'Velachery Main Road' },
  { area: 'Selaiyur', pincode: '600073', lng: 80.1412, lat: 12.9156, street: 'Camp Road Junction' },
  { area: 'Chitlapakkam', pincode: '600064', lng: 80.1512, lat: 12.9389, street: 'Chitlapakkam 1st Main Road' },

  // 31-40: OMR IT Corridor
  { area: 'Taramani', pincode: '600113', lng: 80.2412, lat: 12.9867, street: 'Ascendas IT Park Road' },
  { area: 'Kandanchavadi', pincode: '600096', lng: 80.2489, lat: 12.9734, street: 'OMR Expressway' },
  { area: 'Perungudi', pincode: '600096', lng: 80.2427, lat: 12.9654, street: 'Industrial Estate Main Road' },
  { area: 'Thoraipakkam', pincode: '600097', lng: 80.2376, lat: 12.9416, street: 'OMR Rajiv Gandhi Salai' },
  { area: 'Karapakkam', pincode: '600097', lng: 80.2312, lat: 12.9156, street: 'Near TCS Synergy Park' },
  { area: 'Sholinganallur', pincode: '600119', lng: 80.2279, lat: 12.9010, street: 'Sholinganallur Junction, OMR' },
  { area: 'Semmancheri', pincode: '600119', lng: 80.2245, lat: 12.8712, street: 'Sathyabama University Highway' },
  { area: 'Navalur', pincode: '603103', lng: 80.2230, lat: 12.8458, street: 'Marina Mall Vicinity, OMR' },
  { area: 'Siruseri', pincode: '603103', lng: 80.2173, lat: 12.8236, street: 'SIPCOT IT Park Avenue' },
  { area: 'Kelambakkam', pincode: '603103', lng: 80.2189, lat: 12.7845, street: 'OMR-Vandalur Road Junction' },

  // 41-50: ECR Scenic Coastline
  { area: 'Kottivakkam', pincode: '600041', lng: 80.2612, lat: 12.9712, street: 'ECR Sea Cliff Conclave' },
  { area: 'Palavakkam', pincode: '600041', lng: 80.2577, lat: 12.9610, street: '1st Avenue Beach Road, ECR' },
  { area: 'Neelankarai', pincode: '600115', lng: 80.2588, lat: 12.9485, street: 'Casuarina Drive, ECR' },
  { area: 'Injambakkam', pincode: '600115', lng: 80.2520, lat: 12.9213, street: 'Prarthana Beach Drive' },
  { area: 'Akkarai', pincode: '600119', lng: 80.2497, lat: 12.8980, street: 'Waterland Drive, ECR' },
  { area: 'Panaiyur', pincode: '600119', lng: 80.2478, lat: 12.8812, street: 'Sunrise Avenue, ECR' },
  { area: 'Uthandi', pincode: '600119', lng: 80.2458, lat: 12.8643, street: 'Tollgate Boulevard, ECR' },
  { area: 'Kanathur', pincode: '603112', lng: 80.2445, lat: 12.8312, street: 'Reddikuppam Main Road' },
  { area: 'Muttukadu', pincode: '603112', lng: 80.2423, lat: 12.8123, street: 'Backwaters Promenade, ECR' },
  { area: 'Kovalam', pincode: '603112', lng: 80.2494, lat: 12.7915, street: 'Surf Turf Boulevard' },

  // 51-60: West Chennai Hub
  { area: 'Vadapalani', pincode: '600026', lng: 80.2104, lat: 13.0500, street: '100 Feet Road, Near Forum Vijaya Mall' },
  { area: 'Ashok Nagar', pincode: '600083', lng: 80.2151, lat: 13.0354, street: '1st Avenue, Ashok Pillar' },
  { area: 'K.K. Nagar', pincode: '600078', lng: 80.1989, lat: 13.0382, street: 'P.T. Rajan Salai' },
  { area: 'Virugambakkam', pincode: '600092', lng: 80.1912, lat: 13.0505, street: 'Arcot Road, Near Chandra Mall' },
  { area: 'Saligramam', pincode: '600093', lng: 80.1956, lat: 13.0556, street: 'Dasarathapuram Main Road' },
  { area: 'Valasaravakkam', pincode: '600087', lng: 80.1750, lat: 13.0404, street: 'Arcot Road, Near Mega Mart' },
  { area: 'Ramapuram', pincode: '600089', lng: 80.1793, lat: 13.0316, street: 'Mount-Poonamallee Road, Near DLF' },
  { area: 'Porur', pincode: '600116', lng: 80.1568, lat: 13.0382, street: 'Porur Roundtana, Trunk Road' },
  { area: 'Iyyappanthangal', pincode: '600056', lng: 80.1420, lat: 13.0385, street: 'Near Sri Ramachandra Hospital' },
  { area: 'Mangadu', pincode: '600122', lng: 80.1165, lat: 13.0360, street: 'Kundanatham High Road' },

  // 61-70: West Industrial & Expansion
  { area: 'Poonamallee', pincode: '600056', lng: 80.0889, lat: 13.0489, street: 'Bangalore National Highway' },
  { area: 'Kumananchavadi', pincode: '600056', lng: 80.1120, lat: 13.0450, street: 'Poonamallee High Road' },
  { area: 'Manapakkam', pincode: '600125', lng: 80.1745, lat: 13.0189, street: 'River View Enclave, Near L&T' },
  { area: 'Nandambakkam', pincode: '600089', lng: 80.1856, lat: 13.0145, street: 'Trade Centre Avenue' },
  { area: 'Gerugambakkam', pincode: '600128', lng: 80.1412, lat: 13.0156, street: 'Kundrathur Main Road' },
  { area: 'Kundrathur', pincode: '600069', lng: 80.0989, lat: 12.9989, street: 'Murugan Temple Road' },
  { area: 'Thirumazhisai', pincode: '600124', lng: 80.0389, lat: 13.0567, street: 'Satellite Township Road' },
  { area: 'Karambakkam', pincode: '600116', lng: 80.1523, lat: 13.0345, street: 'Samayapuram Main Road' },
  { area: 'Mugalivakkam', pincode: '600125', lng: 80.1654, lat: 13.0234, street: 'DLF Cybercity Road' },
  { area: 'Alapakkam', pincode: '600116', lng: 80.1689, lat: 13.0512, street: 'Astalakshmi Nagar Main Road' },

  // 71-80: North & North-West
  { area: 'Mogappair East', pincode: '600037', lng: 80.1820, lat: 13.0837, street: 'Spartan Nagar Main Road' },
  { area: 'Mogappair West', pincode: '600037', lng: 80.1654, lat: 13.0789, street: 'Ambattur Estate Road' },
  { area: 'Nolambur', pincode: '600095', lng: 80.1601, lat: 13.0725, street: 'City Union Bank Road' },
  { area: 'Ambattur', pincode: '600053', lng: 80.1548, lat: 13.1143, street: 'OT Bus Terminus Road' },
  { area: 'Ambattur Industrial Estate', pincode: '600058', lng: 80.1612, lat: 13.0989, street: '3rd Phase Industrial Area' },
  { area: 'Padi', pincode: '600050', lng: 80.1873, lat: 13.0984, street: 'Lucas TVS Junction, CTH Road' },
  { area: 'Korattur', pincode: '600080', lng: 80.1793, lat: 13.1105, street: 'Central Avenue, Near Railway Station' },
  { area: 'Villivakkam', pincode: '600049', lng: 80.2078, lat: 13.1075, street: 'Konnur High Road' },
  { area: 'Kolathur', pincode: '600099', lng: 80.2152, lat: 13.1246, street: 'Redhills Road, Near Retteri Lake' },
  { area: 'Perambur', pincode: '600011', lng: 80.2337, lat: 13.1090, street: 'Madhavaram High Road' },

  // 81-90: Deep North & Historic
  { area: 'Avadi', pincode: '600054', lng: 80.1005, lat: 13.1147, street: 'HVF Road, Near Checkpost' },
  { area: 'Pattabiram', pincode: '600072', lng: 80.0589, lat: 13.1234, street: 'TIDEL Park Road' },
  { area: 'Thirumullaivoyal', pincode: '600062', lng: 80.1289, lat: 13.1289, street: 'CTH Road, Near Vaishnavi Nagar' },
  { area: 'Madhavaram', pincode: '600060', lng: 80.2323, lat: 13.1489, street: 'Madhavaram Milk Colony Road' },
  { area: 'Red Hills', pincode: '600052', lng: 80.1963, lat: 13.1979, street: 'GNT Road, Near Grand Northern Trunk' },
  { area: 'Puzhal', pincode: '600066', lng: 80.2012, lat: 13.1612, street: 'Jail Road, Puzhal Bypass' },
  { area: 'Vyasarpadi', pincode: '600039', lng: 80.2512, lat: 13.1189, street: 'Dr. Ambedkar College Road' },
  { area: 'Sowcarpet', pincode: '600079', lng: 80.2785, lat: 13.0978, street: 'Mint Street, Near Elephant Gate' },
  { area: 'George Town', pincode: '600001', lng: 80.2878, lat: 13.0903, street: 'Armenian Street, High Court Area' },
  { area: 'Royapuram', pincode: '600013', lng: 80.2949, lat: 13.1137, street: 'Mannarsamy Koil Street' },

  // 91-100: GST Road & Deep South
  { area: 'Pallavaram', pincode: '600043', lng: 80.1504, lat: 12.9675, street: 'GST Road, Near Airport Corridor' },
  { area: 'Chromepet', pincode: '600044', lng: 80.1412, lat: 12.9516, street: 'CLRI Colony, Station Road' },
  { area: 'Hasthinapuram', pincode: '600064', lng: 80.1589, lat: 12.9456, street: 'Gayathri Nagar Main Road' },
  { area: 'East Tambaram', pincode: '600059', lng: 80.1289, lat: 12.9212, street: 'MCC College Road' },
  { area: 'West Tambaram', pincode: '600045', lng: 80.1089, lat: 12.9245, street: 'Shanmugam Road, Near Bus Terminus' },
  { area: 'Perungalathur', pincode: '600063', lng: 80.0898, lat: 12.9056, street: 'Kamarajar Salai, GST Road' },
  { area: 'Vandalur', pincode: '600048', lng: 80.0812, lat: 12.8894, street: 'Zoo Road Junction, Outer Ring Road' },
  { area: 'Urapakkam', pincode: '603210', lng: 80.0689, lat: 12.8678, street: 'Karanai Puducherry Road' },
  { area: 'Guduvanchery', pincode: '603202', lng: 80.0612, lat: 12.8456, street: 'Nellikuppam Road' },
  { area: 'Potheri', pincode: '603203', lng: 80.0412, lat: 12.8234, street: 'SRM University Gate Avenue' },
];

// Curated Fitness Brand Name Prefixes & Suffixes
const BRAND_NAMES = [
  'FitZone Luxury Club',
  'Titanium Iron Gym',
  'PowerHouse Fitness',
  'CoreFit Performance Club',
  'Iron Temple Gym',
  'Zenith Crossfit Box',
  'Beast Mode Fitness Hub',
  'Peak Performance Studio',
  'Pulse Health & Athletics',
  'Slam Fitness Arena',
  'Snap Fitness 24/7',
  'Gold Standard Gym',
  'Ozone Club & Spa',
  'Chisel Strength Lab',
  'Alpha Athletic Club',
  'Urban Muscle Gym',
  'Vibe Fitness Lounge',
  'Burnout Fitness Studio',
  'Equinox Elite Club',
  'Steel House Fitness',
  'Volt Power Gym',
  'Olympia Fitness Centre',
  'Raw Iron Strength Studio',
  'Cult Athletic Club',
  'Flex Factory Gym',
];

const OWNER_NAMES = [
  'Vikram Seth', 'Karthik Raman', 'Rajesh Kannan', 'Arvind Swamy', 'Sanjay Balan',
  'Pradeep Kumar', 'Ashwin Narayanan', 'Gautham Menon', 'Dinesh Karthik', 'Manoj Prabhakar',
  'Vignesh Shivan', 'Deepak Chandran', 'Suresh Raina', 'Anand Kumar', 'Vijay Raghavan',
  'Harish Kalyan', 'Naveen Polishetty', 'Praveen Gandhi', 'Mohan Sundaram', 'Raghavendra Rao',
];

const TRAINER_FIRST_NAMES = [
  'Arun', 'Sneha', 'Kavitha', 'Surya', 'Pooja', 'Gokul', 'Divya', 'Siddharth', 'Meenakshi',
  'Rahul', 'Swetha', 'Akash', 'Priyanka', 'Sanjay', 'Bhavna', 'Vikas', 'Deepa', 'Vinoth',
  'Anitha', 'Karthik', 'Nithya', 'Manish', 'Lavanya', 'Ajay', 'Revathi', 'Girish', 'Shalini',
];

const SPECIALTIES = [
  'Master Strength Coach & Bodybuilding',
  'CrossFit Level 2 & Functional Trainer',
  'HIIT & Fat Loss Specialist',
  'Certified Olympic Weightlifting Coach',
  'Calisthenics & Mobility Expert',
  'Certified Yoga Acharya & Mindfulness',
  'Zumba Fitness Licensed Instructor',
  'Boxing & Kickboxing Conditioning Coach',
  'Sports Nutrition & Rehab Trainer',
  'Pilates Core & Posture Specialist',
];

const SAMPLE_CUSTOMERS = [
  { email: 'arun.prakash@gymezy.com', fullName: 'Arun Prakash', phone: '+919876500001', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'divya.k@gymezy.com', fullName: 'Divya Krishnan', phone: '+919876500002', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'meenakshi.s@gymezy.com', fullName: 'Meenakshi Sundaram', phone: '+919876500003', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'siddharth.r@gymezy.com', fullName: 'Siddharth Rao', phone: '+919876500004', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'karthik.n@gymezy.com', fullName: 'Karthik Natesan', phone: '+919876500005', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'priya.s@gymezy.com', fullName: 'Priya Sundar', phone: '+919876500006', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'rahul.n@gymezy.com', fullName: 'Rahul Nair', phone: '+919876500007', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'rohan.s@gymezy.com', fullName: 'Rohan Sharma', phone: '+919876500008', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'deepa.v@gymezy.com', fullName: 'Deepa V', phone: '+919876500009', password: 'Password@123', role: 'CUSTOMER' },
  { email: 'pooja.h@gymezy.com', fullName: 'Pooja Hegde', phone: '+919876500010', password: 'Password@123', role: 'CUSTOMER' },
];

export const seed100ChennaiGyms = async () => {
  try {
    console.log('[SEED 100 GYMS] Connecting to MongoDB...');
    await connectDatabase();

    // 1. Ensure sample customers exist
    const customerList = [];
    for (const c of SAMPLE_CUSTOMERS) {
      let u = await User.findOne({ email: c.email });
      if (!u) {
        u = await User.create(c);
      }
      customerList.push(u._id);
    }
    console.log(`[SEED 100 GYMS] Ready with ${customerList.length} customer profiles for review linking.`);

    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < CHENNAI_100_AREAS.length; i++) {
      const loc = CHENNAI_100_AREAS[i];
      const brand = BRAND_NAMES[i % BRAND_NAMES.length];
      const gymName = `${brand} - ${loc.area}`;
      const ownerName = OWNER_NAMES[i % OWNER_NAMES.length];

      // Base pricing with realistic tier calculation
      const singleSessionPrice = 149 + ((i * 17) % 151); // ₹149 - ₹299
      const weeklyPassPrice = singleSessionPrice * 4;
      const fiveSessionsPrice = singleSessionPrice * 4.5;
      const monthlyPrice = 1599 + ((i * 73) % 1601); // ₹1599 - ₹3199
      const quarterlyPrice = Math.round(monthlyPrice * 2.6);
      const halfYearlyPrice = Math.round(monthlyPrice * 4.8);
      const annualPrice = Math.round(monthlyPrice * 8.2);

      const pricingPlans = {
        singleSession: singleSessionPrice,
        weeklyPass: weeklyPassPrice,
        fiveSessions: fiveSessionsPrice,
        monthly: monthlyPrice,
        quarterly: quarterlyPrice,
        halfYearly: halfYearlyPrice,
        annual: annualPrice,
      };

      const primaryImg = GYM_IMAGES_POOL[i % GYM_IMAGES_POOL.length];
      const extraImgs = [
        primaryImg,
        GYM_IMAGES_POOL[(i + 3) % GYM_IMAGES_POOL.length],
        GYM_IMAGES_POOL[(i + 7) % GYM_IMAGES_POOL.length],
        GYM_IMAGES_POOL[(i + 11) % GYM_IMAGES_POOL.length],
      ];

      // Generate 2-3 trainers per gym
      const numTrainers = 2 + (i % 2); // 2 or 3
      const trainersData = [];
      for (let t = 0; t < numTrainers; t++) {
        const tName = `${TRAINER_FIRST_NAMES[(i * 3 + t) % TRAINER_FIRST_NAMES.length]} ${OWNER_NAMES[(i + t) % OWNER_NAMES.length].split(' ')[1] || 'Kumar'}`;
        const tSpec = SPECIALTIES[(i + t * 2) % SPECIALTIES.length];
        const tExp = 3 + ((i + t) % 8); // 3 to 10 years
        const tFee = 2500 + ((i * 100 + t * 300) % 2500); // ₹2500 - ₹4800
        const tAvatar = TRAINER_AVATARS[(i + t) % TRAINER_AVATARS.length];

        trainersData.push({
          name: tName,
          specialty: tSpec,
          experienceYears: tExp,
          rating: 4.8 + ((i + t) % 3) * 0.1,
          reviewsCount: 15 + ((i * 4 + t) % 65),
          monthlyFee: tFee,
          imageUrl: tAvatar,
          ratings: [
            {
              userId: customerList[(i + t) % customerList.length],
              rating: 5,
              comment: `Coach ${tName.split(' ')[0]} is brilliant with workout programming and form cues! Extremely knowledgeable.`,
              bookingType: 'Personal Training',
              date: '1 week ago',
            },
          ],
        });
      }

      // Generate 3 authentic reviews
      const reviewsData = [
        {
          userId: customerList[i % customerList.length],
          rating: 5,
          comment: `State-of-the-art facility in ${loc.area}! The Olympic barbells, imported cardio decks, and clean air conditioning make it the best gym around.`,
          bookingType: 'Monthly Member',
          date: '3 days ago',
        },
        {
          userId: customerList[(i + 1) % customerList.length],
          rating: 5,
          comment: `Seamless check-in with the GYMEZY app QR code. The staff is polite, lockers are pristine, and parking is very convenient.`,
          bookingType: 'Quarterly Member',
          date: '1 week ago',
        },
        {
          userId: customerList[(i + 2) % customerList.length],
          rating: 4,
          comment: `Great workout environment and high-energy music. Steam room is super relaxing after heavy deadlifts.`,
          bookingType: 'Single Session Pass',
          date: '2 weeks ago',
        },
      ];

      const phoneNum = `+91 9840${String(100000 + i).slice(1)}`;
      const emailAddr = `contact.${loc.area.toLowerCase().replace(/[^a-z0-9]+/g, '')}@gymezy.com`;

      const gymPayload = {
        name: gymName,
        tagline: `${loc.area}’s Premier Strength & Conditioning Club`,
        ownerName,
        phone: phoneNum,
        email: emailAddr,
        businessType: 'Private Limited',
        address: loc.street,
        fullAddress: `No. ${12 + (i % 80)}, ${loc.street}, ${loc.area}, Chennai, Tamil Nadu - ${loc.pincode}`,
        area: loc.area,
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: loc.pincode,
        location: {
          type: 'Point',
          coordinates: [loc.lng, loc.lat],
        },
        rating: 4.8 + ((i % 3) * 0.1),
        reviewsCount: 65 + ((i * 9) % 240),
        singleSessionPrice,
        singleSessionBookingEnabled: true,
        pricingPlans,
        image: primaryImg,
        images: extraImgs,
        badgeText: i % 3 === 0 ? 'Top Rated' : i % 3 === 1 ? 'Trending' : 'Verified Elite',
        facilities: [
          'AC Gym',
          'Locker Facility',
          'Shower Available',
          'Steam Room',
          'Parking Available',
          'Juice Bar',
          'Olympic Barbells',
          'Cardio Deck',
        ],
        amenities: [
          'Free High-Speed Wi-Fi',
          'Keyed Private Storage Lockers',
          'Hot Showers & Clean Changing Rooms',
          'Steam / Sauna Bath',
          'Valet & Bike Parking',
          'Chilled RO Drinking Water',
          'Automated Defibrillator & First Aid',
        ],
        workouts: ['Strength', 'HIIT', 'CrossFit', 'Cardio', 'Personal Training', 'Yoga', 'Zumba'],
        tags: ['Strength', 'HIIT', 'CrossFit', 'Personal Training', 'AC Gym', 'Top Rated'],
        enabledSessionCategories: [
          'Gym Access',
          'Group Classes',
          'Yoga Classes',
          'Zumba Sessions',
          'HIIT',
          'CrossFit',
          'Pilates',
        ],
        aboutText: `${gymName} is ${loc.area}’s destination for high-performance fitness. Equipped with world-class resistance equipment, free weights, Olympic lifting platforms, and luxury locker suites.`,
        rules: [
          'Mandatory clean athletic shoes and workout attire at all times.',
          'Always bring and use a personal sweat towel on all benches and machines.',
          'Re-rack all dumbbells, barbells, and plates after your sets.',
          'Wipe down equipment surfaces after use.',
          'No video recording in locker rooms or shower areas.',
        ],
        safetyMeasures: [
          '24/7 HD CCTV surveillance across all workout floors.',
          'Certified First-Aid and CPR trained coaches on duty.',
          'Daily UV and antibacterial deep-sanitization of machines and mats.',
          'Medical emergency kit and AED on premise.',
        ],
        floorSpaceSqFt: 4500 + ((i * 150) % 4000),
        maxFloorCapacity: 80 + ((i * 5) % 80),
        slotDurationMinutes: 90,
        maxSlotCapacity: 25,
        freeCancellationHours: 4,
        refundPercentage: 100,
        rescheduleAllowedCount: 2,
        openingHours: {
          mode: 'REGULAR',
          weekdayOpen: '05:30 AM',
          weekdayClose: '10:30 PM',
          weekendOpen: '06:00 AM',
          weekendClose: '09:00 PM',
          displayText: '05:30 AM - 10:30 PM',
          isSplitShift: false,
          isOpenHolidays: true,
          is24Hours: false,
        },
        slotsMorning: ['05:30 AM - 07:00 AM', '07:00 AM - 08:30 AM', '08:30 AM - 10:00 AM', '10:00 AM - 11:30 AM'],
        slotsEvening: ['04:30 PM - 06:00 PM', '06:00 PM - 07:30 PM', '07:30 PM - 09:00 PM', '09:00 PM - 10:30 PM'],
        status: 'Active',
        approvalStatus: 'Approved',
        isActive: true,
      };

      const existing = await Gym.findOne({ name: gymPayload.name });
      let currentGymId;
      let currentPartnerId;

      if (!existing) {
        const partnerSeq = await Counter.getNextSequence('gym_partner_id');
        currentPartnerId = `GYM${partnerSeq}`;
        const createdGym = await Gym.create({
          ...gymPayload,
          partnerId: currentPartnerId,
          slug: gymPayload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          trainers: [],
          ratings: reviewsData,
          reviews: reviewsData,
          customPricingPlans: buildStandardCustomPricingPlans(pricingPlans),
        });
        currentGymId = createdGym._id;
        createdCount++;
        console.log(`[${i + 1}/100] Created: ${gymPayload.name} (${currentPartnerId}) in ${loc.area}, Pincode: ${loc.pincode}`);
      } else {
        existing.location = gymPayload.location;
        existing.area = gymPayload.area;
        existing.city = gymPayload.city;
        existing.state = gymPayload.state;
        existing.pincode = gymPayload.pincode;
        existing.address = gymPayload.address;
        existing.fullAddress = gymPayload.fullAddress;
        existing.tagline = gymPayload.tagline;
        existing.ownerName = gymPayload.ownerName;
        existing.phone = gymPayload.phone;
        existing.email = gymPayload.email;
        existing.facilities = gymPayload.facilities;
        existing.amenities = gymPayload.amenities;
        existing.workouts = gymPayload.workouts;
        existing.tags = gymPayload.tags;
        existing.badgeText = gymPayload.badgeText;
        existing.aboutText = gymPayload.aboutText;
        existing.rating = gymPayload.rating;
        existing.reviewsCount = gymPayload.reviewsCount;
        existing.singleSessionPrice = gymPayload.singleSessionPrice;
        existing.pricingPlans = gymPayload.pricingPlans;
        existing.customPricingPlans = buildStandardCustomPricingPlans(pricingPlans, existing.customPricingPlans);
        existing.image = gymPayload.image;
        existing.images = gymPayload.images;
        existing.status = 'Active';
        existing.approvalStatus = 'Approved';
        existing.isActive = true;
        await existing.save();
        currentGymId = existing._id;
        currentPartnerId = existing.partnerId;
        updatedCount++;
        console.log(`[${i + 1}/100] Updated: ${gymPayload.name} (${currentPartnerId}) in ${loc.area}`);
      }

      // Ensure trainers exist in Employee collection (SSOT)
      for (const tr of trainersData) {
        const empExists = await Employee.findOne({
          $or: [{ gymPartnerId: currentPartnerId }, { gymId: currentGymId }],
          name: tr.name.trim(),
          role: 'Trainer',
        });
        if (!empExists) {
          const seq = await Counter.getNextSequence(`emp_${currentPartnerId}`);
          const employeeId = `TR${String(seq).padStart(3, '0')}`;
          await Employee.create({
            gymId: currentGymId,
            gymPartnerId: currentPartnerId,
            gymName: gymPayload.name,
            employeeId,
            name: tr.name.trim(),
            role: 'Trainer',
            avatar: tr.imageUrl || '',
            specialty: tr.specialty || 'Certified Fitness Trainer',
            experienceYears: Number(tr.experienceYears) || 2,
            rating: Number(tr.rating) || 4.9,
            reviewsCount: Number(tr.reviewsCount) || 0,
            ratings: Array.isArray(tr.ratings) ? tr.ratings : [],
            status: 'Active',
            attendance: 'Present',
            approvalStatus: 'Approved',
            pendingAction: 'NONE',
            type: 'Full-Time',
            accessType: 'Employee',
            joinDate: '01 Jan 2026',
            approvedBy: 'Seed Script',
            approvedAt: new Date(),
          });
        }
      }
    }

    const totalInDb = await Gym.countDocuments();
    console.log(`\n======================================================`);
    console.log(`[SEED 100 CHENNAI GYMS SUCCESS]`);
    console.log(`Created: ${createdCount} new gyms`);
    console.log(`Updated: ${updatedCount} existing gyms`);
    console.log(`Total Gyms currently in MongoDB: ${totalInDb}`);
    console.log(`======================================================\n`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[SEED 100 GYMS ERROR]:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seed100ChennaiGyms.js')) {
  seed100ChennaiGyms();
}
