import { Room, Client, Delayed, matchMaker } from "colyseus";

interface PlayerLocation {
  longitude: number;
  latitude: number;
}

interface ClientStat {
  client: Client;
  waitingTime: number;
  options?: any;
  location: PlayerLocation;
  availability: string[];
  assignedPatients: number;
  userType: string;
  bestFit: ClientStat[];
  name: string;
}


export class RankedLobbyRoom extends Room {
  /**
   * If `allowUnmatchedGroups` is true, players inside an unmatched group (that
   * did not reached `numClientsToMatch`, and `maxWaitingTime` has been
   * reached) will be matched together. Your room should fill the remaining
   * spots with "bots" on this case.
   */
  allowUnmatchedGroups: boolean = false

  /**
   * Evaluate groups for each client at interval
   */
  evaluateGroupsInterval = 2000;

   /**
   * name of the room to create
   */
  roomToCreate = "game";

  /**
   * after this time, create a match with a bot
   */
  maxWaitingTime = 15 * 1000;

  maxCaregiverThreshold = 5;

  /**
   * after this time, try to fit this client with a not-so-compatible group
   */
  maxWaitingTimeForPriority?: number = 10 * 1000;

  /**
   * number of players on each match
   */
  numClientsToMatch = 4;

  // /**
  //  * after a group is ready, clients have this amount of milliseconds to confirm
  //  * connection to the created room
  //  */
  // cancelConfirmationAfter = 5000;

  /**
   * rank and group cache per-player
   */
  stats: ClientStat[] = [];

  onCreate(options: any) {
    if (options.maxWaitingTime) {
      this.maxWaitingTime = options.maxWaitingTime;  // set instance variables for the room
    }

    if (options.numClientsToMatch) {
      this.numClientsToMatch = options.numClientsToMatch;
    }

    this.onMessage("confirm", (client: Client, message: any) => {
      const stat = this.stats.find(stat => stat.client === client);
    })

    /**
     * Try to match clients into groups at each interval
     */
    this.setSimulationInterval(() => this.redistributeGroups(), this.evaluateGroupsInterval);
  }

  onJoin(client: Client, options: any) {
    console.log(options);
    this.stats.push({
      client: client,
      waitingTime: 0,
      location: {longitude: options.longitude, latitude: options.latitude},
      availability: options.availability,
      assignedPatients: options.assignedPatients,
      userType: options.userType,
      bestFit: [],
      name: options.name,
    });
    client.send("clients", 1);
  }
  
  redistributeGroups() {
    // re-set all groups
    const stats = this.stats.sort((a, b) => a.location.longitude - b.location.longitude);
    const patients = this.stats.filter(user => user.userType === 'patient');
    const caregivers = this.stats.filter(user => user.userType === 'caregiver');

    patients.forEach((patient) => {
      caregivers.forEach((caregiver) => {
        const rank = this.genRankUsers(patient, caregiver);
        if(rank > 25){
          if(!patient.bestFit.some(elem => elem === caregiver)){
            caregiver.bestFit.push(patient);
            patient.bestFit.push(caregiver);
          }
        }
      })
    })
    this.checkGroupsReady();
  }

  genRankUsers(patient: ClientStat, caregiver: ClientStat){
    return 50;
  }

  checkGroupsReady() {
      this.stats.forEach(user => {
        user.client.send("clients", user.bestFit.map(element => element.name).join(", "));
      });
    
  }

  onLeave(client: Client, consented: boolean) {
    const index = this.stats.findIndex(stat => stat.client === client);
    this.stats.splice(index, 1);
  }

  onDispose() {
  }

}
